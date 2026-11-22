import { z } from "zod";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { CommitRecord, GitHistoryPort } from "../../src/application/ports/git-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { GitFailure } from "../../src/domain/repository/git-failure.ts";
import type { Result } from "../../src/domain/result.ts";
import { type ChangeEntry, changeEntryOf } from "../commit-subject/conventional-subject.ts";
import { packageVersionOf } from "../packaging/published-manifest/published-manifest.ts";
import {
  CHANGELOG_FILE,
  changelogGroupOf,
  changelogSectionOf,
  changelogWithSection,
} from "./changelog.ts";
import {
  changeSizeOf,
  channelOf,
  nextVersionOf,
  RELEASE_TAG_PREFIX,
  type Release,
  type ReleaseChannel,
  type ReleaseLine,
  releaseLineOf,
  type ReleaseSize,
  releaseSizeOf,
  versionText,
} from "./release-version.ts";

export type ReleasePullRequestPorts = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly history: GitHistoryPort;
  readonly moduleUrl: string;
};

type Prepared<Value> = Result<Value, string>;

type PreparedFile = { readonly path: string; readonly text: string };

type RepositoryFiles = {
  readonly changelog: PreparedFile;
  readonly manifest: PreparedFile;
};

type MergedHistory = {
  readonly line: ReleaseLine;
  readonly entries: readonly ChangeEntry[];
  readonly lineEntries: readonly ChangeEntry[];
};

type NextRelease = {
  readonly from: Release;
  readonly sizedFrom: Release;
  readonly version: string;
  readonly size: ReleaseSize;
  readonly channel: ReleaseChannel;
  readonly entries: readonly ChangeEntry[];
  readonly lineEntries: readonly ChangeEntry[];
};

type FileUpdate = { readonly path: string; readonly original: string; readonly updated: string };

type PreparedRelease = NextRelease & { readonly updates: readonly FileUpdate[] };

type WriteFailure = { readonly detail: string; readonly written: readonly FileUpdate[] };

const COMMAND = "release-pull-request";

const USAGE = `usage: ${COMMAND} [pre-release|stable]\n`;

const MANIFEST_FILE = "package.json";

const channelArgumentsSchema = z.union([z.tuple([]), z.tuple([z.enum(["pre-release", "stable"])])]);

const gitFailureText = (request: { readonly failure: GitFailure }): string =>
  `${request.failure.command} failed: ${request.failure.detail}`;

const FOLDERS_BETWEEN_REPOSITORY_ROOT_AND_SCRIPT = 2;

const repositoryRootOf = (request: ReleasePullRequestPorts): Prepared<AbsolutePath> => {
  const script = request.path.fromFileUrl({ url: request.moduleUrl });
  if (script.outcome === "failed") {
    return { outcome: "failed", error: `cannot locate the repository: ${script.error.detail}` };
  }
  const root = request.path.resolve({
    path: Array.from({ length: FOLDERS_BETWEEN_REPOSITORY_ROOT_AND_SCRIPT + 1 }).reduce<string>(
      (path) => request.path.directoryOf({ path }),
      script.value,
    ),
  });
  return root.outcome === "failed"
    ? { outcome: "failed", error: `cannot resolve the repository root ${root.error.path}` }
    : root;
};

const fileAt = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Prepared<PreparedFile> => {
  const read = request.fileText.read({ path: request.path });
  return read.outcome === "failed"
    ? { outcome: "failed", error: `cannot read ${read.error.path}: ${read.error.detail}` }
    : { outcome: "ok", value: { path: request.path, text: read.value } };
};

const repositoryFilesOf = (
  request: ReleasePullRequestPorts & { readonly repoRoot: AbsolutePath },
): Prepared<RepositoryFiles> => {
  const manifest = fileAt({
    fileText: request.fileText,
    path: request.path.join({ segments: [request.repoRoot, MANIFEST_FILE] }),
  });
  if (manifest.outcome === "failed") {
    return manifest;
  }
  const changelog = fileAt({
    fileText: request.fileText,
    path: request.path.join({ segments: [request.repoRoot, CHANGELOG_FILE] }),
  });
  return changelog.outcome === "failed"
    ? changelog
    : { outcome: "ok", value: { changelog: changelog.value, manifest: manifest.value } };
};

const SINGLE_PARENT = 1;

const firstLineOf = (request: { readonly message: string }): string =>
  request.message.split("\n", 1).join("");

const mergeCountText = (request: { readonly count: number }): string =>
  request.count === 1 ? "a merge commit" : `${request.count} merge commits`;

const linearMessagesOf = (request: {
  readonly commits: readonly CommitRecord[];
  readonly release: Release;
}): Prepared<readonly string[]> => {
  const merges = request.commits.filter((commit) => commit.parentCount > SINGLE_PARENT);
  if (merges.length === 0) {
    return { outcome: "ok", value: request.commits.map((commit) => commit.message) };
  }
  const named = merges
    .map((merge) => JSON.stringify(firstLineOf({ message: merge.message })))
    .join(", ");
  return {
    outcome: "failed",
    error: `the commits since ${request.release.tag} include ${mergeCountText({ count: merges.length })}, ${named}, and a merge's other parent brings in changes this script cannot size from one line of subjects. Run it on a new branch at the tip of main, before anything is committed to it; if main itself holds a merge since the tag, prepare this release by hand.`,
  };
};

const entriesSince = (request: {
  readonly history: GitHistoryPort;
  readonly repoRoot: AbsolutePath;
  readonly release: Release;
}): Prepared<readonly ChangeEntry[]> => {
  const commits = request.history.commitsAfter({
    repoRoot: request.repoRoot,
    revision: request.release.tag,
  });
  if (commits.outcome === "failed") {
    return { outcome: "failed", error: gitFailureText({ failure: commits.error }) };
  }
  const messages = linearMessagesOf({ commits: commits.value, release: request.release });
  return messages.outcome === "failed"
    ? messages
    : { outcome: "ok", value: messages.value.map((message) => changeEntryOf({ message })) };
};

const mergedHistoryOf = (request: {
  readonly history: GitHistoryPort;
  readonly repoRoot: AbsolutePath;
}): Prepared<MergedHistory> => {
  const tags = request.history.mergedTags({
    repoRoot: request.repoRoot,
    pattern: `${RELEASE_TAG_PREFIX}*`,
  });
  if (tags.outcome === "failed") {
    return { outcome: "failed", error: gitFailureText({ failure: tags.error }) };
  }
  const line = releaseLineOf({ tags: tags.value });
  if (line.outcome === "failed") {
    return line;
  }
  const entries = entriesSince({ ...request, release: line.value.latest });
  if (entries.outcome === "failed") {
    return entries;
  }
  const lineEntries = entriesSince({ ...request, release: line.value.start });
  return lineEntries.outcome === "failed"
    ? lineEntries
    : {
        outcome: "ok",
        value: { line: line.value, entries: entries.value, lineEntries: lineEntries.value },
      };
};

const nextReleaseOf = (request: {
  readonly history: MergedHistory;
  readonly requestedChannel: ReleaseChannel | undefined;
}): Prepared<NextRelease> => {
  const { line, entries, lineEntries } = request.history;
  const size = releaseSizeOf({ entries: lineEntries });
  if (entries.length === 0 || size === "nothing") {
    return {
      outcome: "failed",
      error: `nothing is merged since ${line.latest.tag}, so there is nothing to release.`,
    };
  }
  const channel = request.requestedChannel ?? channelOf({ version: line.latest.version });
  const version = versionText({
    version: nextVersionOf({ current: line.latest.version, size, channel }),
  });
  return {
    outcome: "ok",
    value: {
      from: line.latest,
      sizedFrom: line.start,
      version,
      size,
      channel,
      entries,
      lineEntries,
    },
  };
};

const releasedManifestVersionOf = (request: {
  readonly manifest: string;
  readonly release: Release;
}): Prepared<string> => {
  const manifestVersion = packageVersionOf({ developmentManifest: request.manifest });
  if (manifestVersion.outcome === "failed") {
    return {
      outcome: "failed",
      error: `${MANIFEST_FILE} has no readable version: ${manifestVersion.error.detail}`,
    };
  }
  const releasedVersion = versionText({ version: request.release.version });
  return manifestVersion.value === releasedVersion
    ? { outcome: "ok", value: releasedVersion }
    : {
        outcome: "failed",
        error: `${MANIFEST_FILE} is at ${manifestVersion.value}, not ${request.release.tag}'s ${releasedVersion}, so a release is already prepared or the tag is missing.`,
      };
};

const manifestWithVersion = (request: {
  readonly manifest: string;
  readonly from: string;
  readonly to: string;
}): Prepared<string> => {
  const field = `"version": ${JSON.stringify(request.from)}`;
  const pieces = request.manifest.split(field);
  return pieces.length === 2
    ? { outcome: "ok", value: pieces.join(`"version": ${JSON.stringify(request.to)}`) }
    : { outcome: "failed", error: `${MANIFEST_FILE} does not hold ${field} exactly once` };
};

const fileUpdatesOf = (request: {
  readonly next: NextRelease;
  readonly files: RepositoryFiles;
}): Prepared<readonly FileUpdate[]> => {
  const releasedVersion = releasedManifestVersionOf({
    manifest: request.files.manifest.text,
    release: request.next.from,
  });
  if (releasedVersion.outcome === "failed") {
    return releasedVersion;
  }
  const changelog = changelogWithSection({
    changelog: request.files.changelog.text,
    version: request.next.version,
    section: changelogSectionOf({ version: request.next.version, entries: request.next.entries }),
  });
  if (changelog.outcome === "failed") {
    return changelog;
  }
  const manifest = manifestWithVersion({
    manifest: request.files.manifest.text,
    from: releasedVersion.value,
    to: request.next.version,
  });
  return manifest.outcome === "failed"
    ? manifest
    : {
        outcome: "ok",
        value: [
          {
            path: request.files.changelog.path,
            original: request.files.changelog.text,
            updated: changelog.value,
          },
          {
            path: request.files.manifest.path,
            original: request.files.manifest.text,
            updated: manifest.value,
          },
        ],
      };
};

const preparedRelease = (
  request: ReleasePullRequestPorts & { readonly requestedChannel: ReleaseChannel | undefined },
): Prepared<PreparedRelease> => {
  const repoRoot = repositoryRootOf(request);
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const history = mergedHistoryOf({ history: request.history, repoRoot: repoRoot.value });
  if (history.outcome === "failed") {
    return history;
  }
  const next = nextReleaseOf({
    history: history.value,
    requestedChannel: request.requestedChannel,
  });
  if (next.outcome === "failed") {
    return next;
  }
  const files = repositoryFilesOf({ ...request, repoRoot: repoRoot.value });
  if (files.outcome === "failed") {
    return files;
  }
  const updates = fileUpdatesOf({ next: next.value, files: files.value });
  return updates.outcome === "failed"
    ? updates
    : { outcome: "ok", value: { ...next.value, updates: updates.value } };
};

const updatesWritten = (request: {
  readonly fileText: FileTextPort;
  readonly updates: readonly FileUpdate[];
}): Result<readonly FileUpdate[], WriteFailure> =>
  request.updates.reduce<Result<readonly FileUpdate[], WriteFailure>>(
    (soFar, update) => {
      if (soFar.outcome === "failed") {
        return soFar;
      }
      const written = request.fileText.write({ path: update.path, text: update.updated });
      return written.outcome === "failed"
        ? {
            outcome: "failed",
            error: {
              detail: `cannot write ${written.error.path}: ${written.error.detail}`,
              written: soFar.value,
            },
          }
        : { outcome: "ok", value: [...soFar.value, update] };
    },
    { outcome: "ok", value: [] },
  );

const restorationText = (request: {
  readonly fileText: FileTextPort;
  readonly written: readonly FileUpdate[];
}): string => {
  if (request.written.length === 0) {
    return "nothing was changed";
  }
  const unrestored = request.written.flatMap((update) =>
    request.fileText.write({ path: update.path, text: update.original }).outcome === "failed"
      ? [update.path]
      : [],
  );
  return unrestored.length === 0
    ? "the files it had written are restored"
    : `restore ${unrestored.join(" and ")} by hand`;
};

const writtenUpdates = (request: {
  readonly fileText: FileTextPort;
  readonly updates: readonly FileUpdate[];
}): Prepared<null> => {
  const written = updatesWritten(request);
  return written.outcome === "ok"
    ? { outcome: "ok", value: null }
    : {
        outcome: "failed",
        error: `${written.error.detail}; ${restorationText({ fileText: request.fileText, written: written.error.written })}`,
      };
};

const subjectCountText = (request: { readonly count: number }): string =>
  `${request.count} ${request.count === 1 ? "subject" : "subjects"}`;

const summaryOf = (request: { readonly prepared: PreparedRelease }): string =>
  `${COMMAND}: ${versionText({ version: request.prepared.from.version })} to ${request.prepared.version}, a ${request.prepared.size} change on the ${request.prepared.channel} channel, sized from ${subjectCountText({ count: request.prepared.lineEntries.length })} since ${request.prepared.sizedFrom.tag}, with ${subjectCountText({ count: request.prepared.entries.length })} since ${request.prepared.from.tag} in its section. ${CHANGELOG_FILE} and ${MANIFEST_FILE} are updated in the working tree; no tag was made and nothing was published.\n`;

const unclassifiedWarningsOf = (request: {
  readonly entries: readonly ChangeEntry[];
}): readonly string[] =>
  request.entries.flatMap((entry) =>
    entry.kind === "unclassified"
      ? [
          `${COMMAND}: ${JSON.stringify(entry.subject)} is not a conventional subject; it is listed under ${changelogGroupOf({ entry })} and counted as a ${changeSizeOf({ entry })}.\n`,
        ]
      : [],
  );

const refused = (request: { readonly process: ProcessPort; readonly reason: string }): void => {
  request.process.writeError({ text: `${COMMAND}: ${request.reason}\n` });
  request.process.exitWith({ code: 1 });
};

export const runReleasePullRequest = (request: ReleasePullRequestPorts): void => {
  const channelArguments = channelArgumentsSchema.safeParse(request.process.arguments);
  if (!channelArguments.success) {
    request.process.writeError({ text: USAGE });
    request.process.exitWith({ code: 2 });
    return;
  }
  const [requestedChannel] = channelArguments.data;
  const prepared = preparedRelease({ ...request, requestedChannel });
  if (prepared.outcome === "failed") {
    refused({ process: request.process, reason: prepared.error });
    return;
  }
  const written = writtenUpdates({ fileText: request.fileText, updates: prepared.value.updates });
  if (written.outcome === "failed") {
    refused({ process: request.process, reason: written.error });
    return;
  }
  unclassifiedWarningsOf({ entries: prepared.value.entries }).forEach((warning) => {
    request.process.writeError({ text: warning });
  });
  request.process.writeOut({ text: summaryOf({ prepared: prepared.value }) });
  request.process.exitWith({ code: 0 });
};

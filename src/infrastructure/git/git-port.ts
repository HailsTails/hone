import type {
  BaseContentMembership,
  BaseFileText,
  CommitRecord,
  GitContentQuery,
  GitHistoryPort,
  GitPort,
  GitTreePort,
} from "../../application/ports/git-port.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { GitFailure } from "../../domain/repository/git-failure.ts";
import type { RenamedPath, RenamedPaths } from "../../domain/repository/renamed-path.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import {
  createDefaultExecutionPort,
  type ExecutionPolicy,
} from "../node/process/execution-port.ts";

export type GitEnvironment = Readonly<Record<string, string | undefined>>;

export type GitRun =
  | {
      readonly outcome: "exited";
      readonly status: number;
      readonly stdout: string;
      readonly stderr: string;
    }
  | { readonly outcome: "errored"; readonly detail: string };

export type GitSpawnRequest = {
  readonly file: string;
  readonly arguments: readonly string[];
  readonly maxBuffer: number;
  readonly environment: GitEnvironment;
};

export type GitSpawn = (request: GitSpawnRequest) => GitRun;

const REPOSITORY_LOCATION_VARIABLES: readonly string[] = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_SHALLOW_FILE",
  "GIT_GRAFT_FILE",
];

const LARGEST_GIT_OUTPUT_BYTES = 256 * 1024 * 1024;

const SUCCESSFUL_EXIT_STATUS = 0;

const environmentWithoutRepositoryLocation = (request: {
  readonly ambientEnvironment: GitEnvironment;
}): GitEnvironment =>
  Object.fromEntries(
    Object.entries(request.ambientEnvironment).filter(
      ([name]) => !REPOSITORY_LOCATION_VARIABLES.includes(name),
    ),
  );

const GIT_EXECUTION_POLICY: ExecutionPolicy = {
  executable: "git",
  environment: ({ ambient }) =>
    environmentWithoutRepositoryLocation({ ambientEnvironment: ambient }),
  timeoutMilliseconds: undefined,
  maximumOutputBytes: LARGEST_GIT_OUTPUT_BYTES,
};

const parsedRepoPaths = (request: {
  readonly listed: readonly string[];
}): Result<readonly RepoPath[], string> => {
  const parsed = request.listed.map((text) => ({ text, result: repoPathSchema.safeParse(text) }));
  const refused = parsed.find((entry) => !entry.result.success);
  if (refused !== undefined) {
    return { outcome: "failed", error: refused.text };
  }
  return {
    outcome: "ok",
    value: parsed.flatMap((entry) => (entry.result.success ? [entry.result.data] : [])),
  };
};

const gitOutput = (request: {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
  readonly gitArguments: readonly string[];
}): Result<{ readonly command: string; readonly stdout: string }, GitFailure> => {
  const fullArguments = ["-C", request.repoRoot, ...request.gitArguments];
  const command = `git ${fullArguments.join(" ")}`;
  const run = request.spawn({
    file: "git",
    arguments: fullArguments,
    maxBuffer: LARGEST_GIT_OUTPUT_BYTES,
    environment: request.environment,
  });
  if (run.outcome === "errored") {
    return {
      outcome: "failed",
      error: { kind: "git-failed", command, detail: run.detail },
    };
  }
  if (run.status !== SUCCESSFUL_EXIT_STATUS) {
    return {
      outcome: "failed",
      error: { kind: "git-failed", command, detail: run.stderr },
    };
  }
  return { outcome: "ok", value: { command, stdout: run.stdout } };
};

const gitPaths = (request: {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
  readonly gitArguments: readonly string[];
}): Result<readonly RepoPath[], GitFailure> => {
  const output = gitOutput(request);
  if (output.outcome === "failed") {
    return output;
  }
  const parsedPaths = parsedRepoPaths({
    listed: output.value.stdout.split("\0").filter((text) => text.length > 0),
  });
  if (parsedPaths.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: output.value.command,
        detail: `git listed a path that is not a repo path: ${parsedPaths.error}`,
      },
    };
  }
  return parsedPaths;
};

type GitContext = {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
};

const changedPaths = (
  request: GitContext & { readonly baseRevision: string },
): Result<readonly RepoPath[], GitFailure> => {
  const committed = gitPaths({
    ...request,
    gitArguments: [
      "diff",
      "--name-only",
      "-z",
      "--end-of-options",
      `${request.baseRevision}...HEAD`,
    ],
  });
  if (committed.outcome === "failed") {
    return committed;
  }
  const uncommitted = gitPaths({ ...request, gitArguments: ["diff", "--name-only", "-z", "HEAD"] });
  if (uncommitted.outcome === "failed") {
    return uncommitted;
  }
  const untracked = gitPaths({
    ...request,
    gitArguments: ["ls-files", "--others", "--exclude-standard", "-z"],
  });
  if (untracked.outcome === "failed") {
    return untracked;
  }
  return {
    outcome: "ok",
    value: [...new Set([...committed.value, ...uncommitted.value, ...untracked.value])],
  };
};

const objectNameStatus = (request: { readonly text: string }): "valid" | "invalid" =>
  (request.text.length === 40 || request.text.length === 64) && !/[^0-9a-f]/.test(request.text)
    ? "valid"
    : "invalid";

const contentMembership = (
  request: GitContext & GitContentQuery,
): Result<BaseContentMembership, GitFailure> => {
  const candidate = gitOutput({
    ...request,
    gitArguments: ["hash-object", "--", request.file],
  });
  if (candidate.outcome === "failed") {
    return candidate;
  }
  const candidateHash = candidate.value.stdout.replace(/\r?\n$/, "");
  if (objectNameStatus({ text: candidateHash }) === "invalid") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: candidate.value.command,
        detail: "git hash-object did not return one complete lowercase object name",
      },
    };
  }
  const tree = gitOutput({
    ...request,
    gitArguments: [
      "ls-tree",
      "-r",
      "-z",
      "--format=%(objectname)",
      "--end-of-options",
      request.baseRevision,
    ],
  });
  if (tree.outcome === "failed") {
    return tree;
  }
  const treeHashes = tree.value.stdout === "" ? [] : tree.value.stdout.split("\0").slice(0, -1);
  if (
    (tree.value.stdout !== "" && !tree.value.stdout.endsWith("\0")) ||
    treeHashes.some((text) => objectNameStatus({ text }) === "invalid")
  ) {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: tree.value.command,
        detail: "git ls-tree did not return a complete NUL-separated object-name listing",
      },
    };
  }
  return {
    outcome: "ok",
    value: treeHashes.includes(candidateHash) ? "present-in-base" : "absent-from-base",
  };
};

const fileTextInBase = (
  request: GitContext & GitContentQuery,
): Result<BaseFileText, GitFailure> => {
  const listed = gitPaths({
    ...request,
    gitArguments: [
      "ls-tree",
      "-z",
      "--name-only",
      "--end-of-options",
      request.baseRevision,
      request.file,
    ],
  });
  if (listed.outcome === "failed") {
    return listed;
  }
  if (!listed.value.includes(request.file)) {
    return { outcome: "ok", value: { presence: "absent-from-base" } };
  }
  const blob = gitOutput({
    ...request,
    gitArguments: [
      "cat-file",
      "blob",
      "--end-of-options",
      `${request.baseRevision}:${request.file}`,
    ],
  });
  if (blob.outcome === "failed") {
    return blob;
  }
  return { outcome: "ok", value: { presence: "present-in-base", text: blob.value.stdout } };
};

const NAME_STATUS_ENTRY =
  /(?<pairedStatus>[RC]\d*)\0(?<from>[^\0]+)\0(?<to>[^\0]+)\0|(?![RC])[A-Z]\d*\0[^\0]+\0/gy;

const RENAME_STATUS = /^R/;

const UNCHANGED_RENAME_STATUS = "R100";

type ListedRename = {
  readonly from: string;
  readonly to: string;
  readonly content: RenamedPath["content"];
};

const listedRenamesOf = (request: {
  readonly stdout: string;
}): Result<readonly ListedRename[], "incomplete"> => {
  const entries = [...request.stdout.matchAll(NAME_STATUS_ENTRY)];
  const consumed = entries.reduce((length, entry) => length + entry[0].length, 0);
  if (consumed !== request.stdout.length) {
    return { outcome: "failed", error: "incomplete" };
  }
  return {
    outcome: "ok",
    value: entries.flatMap(({ groups }): readonly ListedRename[] =>
      groups?.pairedStatus !== undefined &&
      RENAME_STATUS.test(groups.pairedStatus) &&
      groups.from !== undefined &&
      groups.to !== undefined
        ? [
            {
              from: groups.from,
              to: groups.to,
              content: groups.pairedStatus === UNCHANGED_RENAME_STATUS ? "unchanged" : "edited",
            },
          ]
        : [],
    ),
  };
};

const basePathByHeadPathOf = (request: {
  readonly rename: ListedRename;
}): Result<readonly [RepoPath, RenamedPath], string> => {
  const from = repoPathSchema.safeParse(request.rename.from);
  if (!from.success) {
    return { outcome: "failed", error: request.rename.from };
  }
  const to = repoPathSchema.safeParse(request.rename.to);
  return to.success
    ? {
        outcome: "ok",
        value: [to.data, { basePath: from.data, content: request.rename.content }],
      }
    : { outcome: "failed", error: request.rename.to };
};

const renamedPaths = (
  request: GitContext & { readonly baseRevision: string },
): Result<RenamedPaths, GitFailure> => {
  const output = gitOutput({
    ...request,
    gitArguments: [
      "diff",
      "--name-status",
      "-M",
      "-z",
      "--merge-base",
      "--end-of-options",
      request.baseRevision,
    ],
  });
  if (output.outcome === "failed") {
    return output;
  }
  const { command } = output.value;
  const listed = listedRenamesOf({ stdout: output.value.stdout });
  if (listed.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command,
        detail: "git diff did not return a complete NUL-separated name-status listing",
      },
    };
  }
  const parsed = listed.value.map((rename) => basePathByHeadPathOf({ rename }));
  const refused = parsed.find((rename) => rename.outcome === "failed");
  if (refused !== undefined && refused.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command,
        detail: `git listed a path that is not a repo path: ${refused.error}`,
      },
    };
  }
  return {
    outcome: "ok",
    value: new Map(
      parsed.flatMap((rename): readonly (readonly [RepoPath, RenamedPath])[] =>
        rename.outcome === "ok" ? [rename.value] : [],
      ),
    ),
  };
};

export const createGitPort = (options: {
  readonly spawn: GitSpawn;
  readonly ambientEnvironment: GitEnvironment;
}): GitPort => {
  const environment = environmentWithoutRepositoryLocation({
    ambientEnvironment: options.ambientEnvironment,
  });
  return {
    trackedPaths: (request) =>
      gitPaths({
        spawn: options.spawn,
        environment,
        repoRoot: request.repoRoot,
        gitArguments: ["ls-files", "-z"],
      }),
    changedSince: (request) =>
      changedPaths({
        spawn: options.spawn,
        environment,
        repoRoot: request.repoRoot,
        baseRevision: request.baseRevision,
      }),
    contentInBase: (request) =>
      contentMembership({ ...request, spawn: options.spawn, environment }),
    textInBase: (request) => fileTextInBase({ ...request, spawn: options.spawn, environment }),
    renamedSince: (request) => renamedPaths({ ...request, spawn: options.spawn, environment }),
  };
};

const TRAILING_LINE_BREAKS = /\n+$/;

const gitListing = (
  request: GitContext & { readonly gitArguments: readonly string[]; readonly separator: string },
): Result<readonly string[], GitFailure> => {
  const output = gitOutput(request);
  if (output.outcome === "failed") {
    return output;
  }
  return {
    outcome: "ok",
    value: output.value.stdout
      .split(request.separator)
      .map((entry) => entry.replace(TRAILING_LINE_BREAKS, ""))
      .filter((entry) => entry.length > 0),
  };
};

const PARENT_SEPARATOR = " ";

const LINE_BREAK = "\n";

const commitRecordOf = (request: { readonly entry: string }): CommitRecord => {
  const [parents, ...messageLines] = request.entry.split(LINE_BREAK);
  return {
    parentCount: parents.split(PARENT_SEPARATOR).filter((parent) => parent.length > 0).length,
    message: messageLines.join(LINE_BREAK),
  };
};

const commitsAfterRevision = (
  request: GitContext & { readonly revision: string },
): Result<readonly CommitRecord[], GitFailure> => {
  const entries = gitListing({
    ...request,
    gitArguments: [
      "log",
      "--reverse",
      "-z",
      "--format=%P%n%B",
      "--end-of-options",
      `${request.revision}..HEAD`,
    ],
    separator: "\0",
  });
  return entries.outcome === "failed"
    ? entries
    : { outcome: "ok", value: entries.value.map((entry) => commitRecordOf({ entry })) };
};

export const createGitTreePort = (options: {
  readonly spawn: GitSpawn;
  readonly ambientEnvironment: GitEnvironment;
}): GitTreePort => {
  const environment = environmentWithoutRepositoryLocation({
    ambientEnvironment: options.ambientEnvironment,
  });
  return {
    pathsAt: (request) =>
      gitPaths({
        spawn: options.spawn,
        environment,
        repoRoot: request.repoRoot,
        gitArguments: ["ls-tree", "-r", "-z", "--name-only", "--end-of-options", request.revision],
      }),
  };
};

export const createGitHistoryPort = (options: {
  readonly spawn: GitSpawn;
  readonly ambientEnvironment: GitEnvironment;
}): GitHistoryPort => {
  const environment = environmentWithoutRepositoryLocation({
    ambientEnvironment: options.ambientEnvironment,
  });
  return {
    mergedTags: (request) =>
      gitListing({
        spawn: options.spawn,
        environment,
        repoRoot: request.repoRoot,
        gitArguments: ["tag", "--list", "--merged", "HEAD", request.pattern],
        separator: "\n",
      }),
    commitsAfter: (request) =>
      commitsAfterRevision({
        spawn: options.spawn,
        environment,
        repoRoot: request.repoRoot,
        revision: request.revision,
      }),
  };
};

const defaultGitSpawn = (): GitSpawn => {
  const execution = createDefaultExecutionPort({ policy: GIT_EXECUTION_POLICY });
  return (request) => {
    const executed = execution.run({ arguments: request.arguments });
    if (executed.outcome === "failed") {
      return {
        outcome: "errored",
        detail:
          executed.error.kind === "terminated"
            ? `git was ended by signal ${executed.error.signal}`
            : executed.error.detail,
      };
    }
    return { outcome: "exited", ...executed.value };
  };
};

export const createDefaultGitPort = (): GitPort =>
  createGitPort({ spawn: defaultGitSpawn(), ambientEnvironment: {} });

export const createDefaultGitTreePort = (): GitTreePort =>
  createGitTreePort({ spawn: defaultGitSpawn(), ambientEnvironment: {} });

export const createDefaultGitHistoryPort = (): GitHistoryPort =>
  createGitHistoryPort({ spawn: defaultGitSpawn(), ambientEnvironment: {} });

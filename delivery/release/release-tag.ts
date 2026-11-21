import { z } from "zod";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { Result } from "../../src/domain/result.ts";
import { remoteTagsOf } from "./release-state.ts";

type ReleaseTagRequest = { readonly tag: string; readonly commit: string; readonly remoteTags: string };

const COMMAND = "release-tag";

const USAGE = `usage: ${COMMAND} <tag> <commit> <git ls-remote tags>\n`;

const releaseTagArgumentsSchema = z.tuple([z.string().min(1), z.string().min(1), z.string()]);

const confirmedTagOf = (request: ReleaseTagRequest): Result<string, string> => {
  const remoteTags = remoteTagsOf({ remoteTags: request.remoteTags });
  if (remoteTags.outcome === "failed") {
    return remoteTags;
  }
  const existing = remoteTags.value.find((remoteTag) => remoteTag.name === request.tag);
  if (existing === undefined) {
    return { outcome: "failed", error: `the remote has no tag ${request.tag} after the release was created, so nothing is staged on npm.` };
  }
  return existing.commit === request.commit
    ? { outcome: "ok", value: `the remote's tag ${request.tag} names this run's commit, so the release is recorded where it was built.` }
    : {
        outcome: "failed",
        error: `the remote's tag ${request.tag} names ${existing.commit}, not this run's commit ${request.commit}: the tag was made outside this workflow while it ran, and the GitHub release ${request.tag} now holds this run's tarball on it. Nothing is staged on npm. Delete the GitHub release ${request.tag}, then release a new version with a new release pull request rather than re-running this run.`,
      };
};

export const runReleaseTag = (request: { readonly process: ProcessPort }): void => {
  const parsed = releaseTagArgumentsSchema.safeParse(request.process.arguments);
  if (!parsed.success) {
    request.process.writeError({ text: USAGE });
    request.process.exitWith({ code: 2 });
    return;
  }
  const [tag, commit, remoteTags] = parsed.data;
  const confirmed = confirmedTagOf({ tag, commit, remoteTags });
  request.process.writeError({ text: `${COMMAND}: ${confirmed.outcome === "ok" ? confirmed.value : confirmed.error}\n` });
  request.process.exitWith({ code: confirmed.outcome === "ok" ? 0 : 1 });
};

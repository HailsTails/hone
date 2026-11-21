import { z } from "zod";
import type { ProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import type { Result } from "../../src/domain/result.ts";
import { packageVersionOf } from "../packaging/published-manifest/published-manifest.ts";
import { RELEASE_TAG_PREFIX, versionOf } from "./release-version.ts";

export type ReleaseStateName = "version-unchanged" | "already-released" | "unreleased";

export type ReleaseState = { readonly tag: string; readonly state: ReleaseStateName };

type ReleaseStateRequest = { readonly commit: string; readonly manifest: string; readonly previousManifest: string; readonly remoteTags: string };

type VersionChange = { readonly version: string; readonly previousVersion: string };

export type RemoteTag = { readonly commit: string; readonly name: string };

const COMMAND = "release-state";

const USAGE = `usage: ${COMMAND} <commit> <package.json> <previous package.json> <git ls-remote tags>\n`;

const releaseStateArgumentsSchema = z.tuple([z.string().min(1), z.string(), z.string(), z.string()]);

const REMOTE_TAG_LINE = /^(?<commit>[0-9a-f]+)\trefs\/tags\/(?<name>.+)$/;

export const remoteTagsOf = (request: { readonly remoteTags: string }): Result<readonly RemoteTag[], string> =>
  request.remoteTags
    .split("\n")
    .filter((line) => line !== "")
    .reduce<Result<readonly RemoteTag[], string>>((soFar, line) => {
      if (soFar.outcome === "failed") {
        return soFar;
      }
      const groups = REMOTE_TAG_LINE.exec(line)?.groups;
      return groups?.commit === undefined || groups.name === undefined
        ? { outcome: "failed", error: `cannot read the remote's tags: ${JSON.stringify(line)} is not a git ls-remote tag line` }
        : { outcome: "ok", value: [...soFar.value, { commit: groups.commit, name: groups.name }] };
    }, { outcome: "ok", value: [] });

const releasableVersionOf = (request: { readonly manifest: string }): Result<string, string> => {
  const version = packageVersionOf({ developmentManifest: request.manifest });
  if (version.outcome === "failed") {
    return { outcome: "failed", error: `package.json has no readable version: ${version.error.detail}` };
  }
  return versionOf({ text: version.value }).outcome === "failed"
    ? {
        outcome: "failed",
        error: `package.json's version ${version.value} is not one this workflow releases: major.minor.patch, optionally followed by -<identifier>.<number>`,
      }
    : version;
};

const versionChangeOf = (request: ReleaseStateRequest): Result<VersionChange, string> => {
  const version = releasableVersionOf({ manifest: request.manifest });
  if (version.outcome === "failed") {
    return version;
  }
  const previousVersion = packageVersionOf({ developmentManifest: request.previousManifest });
  return previousVersion.outcome === "failed"
    ? { outcome: "failed", error: `the previous package.json has no readable version: ${previousVersion.error.detail}` }
    : { outcome: "ok", value: { version: version.value, previousVersion: previousVersion.value } };
};

const changedVersionStateOf = (request: {
  readonly commit: string;
  readonly version: string;
  readonly tag: string;
  readonly remoteTags: string;
}): Result<ReleaseState, string> => {
  const remoteTags = remoteTagsOf({ remoteTags: request.remoteTags });
  if (remoteTags.outcome === "failed") {
    return remoteTags;
  }
  const existing = remoteTags.value.find((remoteTag) => remoteTag.name === request.tag);
  if (existing === undefined) {
    return { outcome: "ok", value: { tag: request.tag, state: "unreleased" } };
  }
  return existing.commit === request.commit
    ? { outcome: "ok", value: { tag: request.tag, state: "already-released" } }
    : {
        outcome: "failed",
        error: `the remote's tag ${request.tag} names ${existing.commit}, not this push's commit ${request.commit}, so this push cannot release ${request.version}: delete the tag if this workflow did not make it, or set package.json to a version with no tag.`,
      };
};

export const releaseStateOf = (request: ReleaseStateRequest): Result<ReleaseState, string> => {
  const change = versionChangeOf(request);
  if (change.outcome === "failed") {
    return change;
  }
  const tag = `${RELEASE_TAG_PREFIX}${change.value.version}`;
  return change.value.version === change.value.previousVersion
    ? { outcome: "ok", value: { tag, state: "version-unchanged" } }
    : changedVersionStateOf({ commit: request.commit, version: change.value.version, tag, remoteTags: request.remoteTags });
};

const versionOfTag = (request: { readonly tag: string }): string => request.tag.slice(RELEASE_TAG_PREFIX.length);

const explanationOf = (request: { readonly state: ReleaseState }): string => {
  const version = versionOfTag({ tag: request.state.tag });
  switch (request.state.state) {
    case "version-unchanged":
      return `this push leaves the version at ${version}, so it releases nothing.`;
    case "already-released":
      return `the remote's tag ${request.state.tag} already names this push's commit, so ${version} is released and this push releases nothing.`;
    case "unreleased":
      return `this push changes the version to ${version} and the remote has no tag ${request.state.tag}, so it releases it.`;
  }
};

export const runReleaseState = (request: { readonly process: ProcessPort }): void => {
  const parsed = releaseStateArgumentsSchema.safeParse(request.process.arguments);
  if (!parsed.success) {
    request.process.writeError({ text: USAGE });
    request.process.exitWith({ code: 2 });
    return;
  }
  const [commit, manifest, previousManifest, remoteTags] = parsed.data;
  const state = releaseStateOf({ commit, manifest, previousManifest, remoteTags });
  if (state.outcome === "failed") {
    request.process.writeError({ text: `${COMMAND}: ${state.error}\n` });
    request.process.exitWith({ code: 1 });
    return;
  }
  request.process.writeError({ text: `${COMMAND}: ${explanationOf({ state: state.value })}\n` });
  request.process.writeOut({ text: `tag=${state.value.tag}\nstate=${state.value.state}\n` });
  request.process.exitWith({ code: 0 });
};

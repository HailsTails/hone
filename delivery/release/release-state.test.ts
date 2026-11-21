import { describe, expect, it, vi } from "vitest";
import type { ProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { releaseStateOf, runReleaseState } from "./release-state.ts";

const manifestAt = (version: string): string => `{\n  "name": "tooled",\n  "version": ${JSON.stringify(version)}\n}`;

const COMMIT = "d32d2530312c64d2938aeab5753737e89f972e48";

const OTHER_COMMIT = "5c9edb1f0e0b2f5a0d6f3c1e9a8b7c6d5e4f3a2b";

const RELEASED_TAGS = `${COMMIT}\trefs/tags/v0.1.0-pre.5\n${COMMIT}\trefs/tags/v0.1.0-pre.6`;

const NEAR_MISS_TAGS = `${COMMIT}\trefs/tags/v1.0.0-pre.1\n${COMMIT}\trefs/tags/v1.0.0.backup\n${COMMIT}\trefs/tags/release-v1.0.0`;

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const runWith = (request: { readonly arguments: readonly string[] }) => {
  const processPort = processWith(request);
  runReleaseState({ process: processPort });
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    errors: vi.mocked(processPort.writeError).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

describe("releaseStateOf deciding the state", () => {
  it("releases a version this push changed to when the remote has no tag for it", () => {
    expect(
      releaseStateOf({ commit: COMMIT, manifest: manifestAt("0.1.0-pre.7"), previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: RELEASED_TAGS }),
    ).toEqual({ outcome: "ok", value: { tag: "v0.1.0-pre.7", state: "unreleased" } });
  });

  it.each([
    { previous: "0.1.0-pre.7", version: "1.0.0" },
    { previous: "1.0.0", version: "1.0.1-pre.1" },
    { previous: "1.0.1-pre.1", version: "1.0.1" },
  ])("releases $version after $previous", ({ previous, version }) => {
    expect(releaseStateOf({ commit: COMMIT, manifest: manifestAt(version), previousManifest: manifestAt(previous), remoteTags: RELEASED_TAGS })).toEqual({
      outcome: "ok",
      value: { tag: `v${version}`, state: "unreleased" },
    });
  });

  it("releases nothing when this push leaves the version as it was, even when that version has no tag", () => {
    expect(
      releaseStateOf({ commit: COMMIT, manifest: manifestAt("0.1.0-pre.7"), previousManifest: manifestAt("0.1.0-pre.7"), remoteTags: RELEASED_TAGS }),
    ).toEqual({ outcome: "ok", value: { tag: "v0.1.0-pre.7", state: "version-unchanged" } });
  });

  it("releases nothing when the version's tag already names this push's commit, as on a re-run after the release", () => {
    expect(
      releaseStateOf({ commit: COMMIT, manifest: manifestAt("0.1.0-pre.6"), previousManifest: manifestAt("0.1.0-pre.5"), remoteTags: RELEASED_TAGS }),
    ).toEqual({ outcome: "ok", value: { tag: "v0.1.0-pre.6", state: "already-released" } });
  });

  it("refuses when the version's tag names another commit, so a tag made outside the workflow cannot pass for its release", () => {
    expect(
      releaseStateOf({ commit: OTHER_COMMIT, manifest: manifestAt("0.1.0-pre.6"), previousManifest: manifestAt("0.1.0-pre.5"), remoteTags: RELEASED_TAGS }),
    ).toEqual({
      outcome: "failed",
      error: `the remote's tag v0.1.0-pre.6 names ${COMMIT}, not this push's commit ${OTHER_COMMIT}, so this push cannot release 0.1.0-pre.6: delete the tag if this workflow did not make it, or set package.json to a version with no tag.`,
    });
  });

  it("releases the first version when the remote has no tags at all", () => {
    expect(releaseStateOf({ commit: COMMIT, manifest: manifestAt("1.0.0"), previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: "" })).toEqual({
      outcome: "ok",
      value: { tag: "v1.0.0", state: "unreleased" },
    });
  });

  it("does not take a tag that only starts with the version's tag as its release", () => {
    expect(
      releaseStateOf({
        commit: COMMIT,
        manifest: manifestAt("1.0.0"),
        previousManifest: manifestAt("0.1.0-pre.6"),
        remoteTags: NEAR_MISS_TAGS,
      }),
    ).toEqual({ outcome: "ok", value: { tag: "v1.0.0", state: "unreleased" } });
  });
});

describe("releaseStateOf refusing what it cannot decide", () => {
  it("refuses a changed version that is not major.minor.patch with an optional -<identifier>.<number>", () => {
    expect(releaseStateOf({ commit: COMMIT, manifest: manifestAt("1.0"), previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: RELEASED_TAGS })).toEqual({
      outcome: "failed",
      error: "package.json's version 1.0 is not one this workflow releases: major.minor.patch, optionally followed by -<identifier>.<number>",
    });
  });

  it("refuses an unchanged version that is not major.minor.patch with an optional -<identifier>.<number>", () => {
    expect(releaseStateOf({ commit: COMMIT, manifest: manifestAt("1.0"), previousManifest: manifestAt("1.0"), remoteTags: RELEASED_TAGS })).toEqual({
      outcome: "failed",
      error: "package.json's version 1.0 is not one this workflow releases: major.minor.patch, optionally followed by -<identifier>.<number>",
    });
  });

  it("refuses a manifest without a readable version", () => {
    expect(releaseStateOf({ commit: COMMIT, manifest: "{}", previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: RELEASED_TAGS })).toEqual({
      outcome: "failed",
      error: expect.stringMatching(/^package\.json has no readable version: .*version/s),
    });
  });

  it("refuses the previous manifest without a readable version", () => {
    expect(releaseStateOf({ commit: COMMIT, manifest: manifestAt("0.1.0-pre.7"), previousManifest: "not json", remoteTags: RELEASED_TAGS })).toEqual({
      outcome: "failed",
      error: expect.stringMatching(/^the previous package\.json has no readable version: /),
    });
  });

  it("refuses remote tags it cannot read as git ls-remote lines", () => {
    expect(
      releaseStateOf({ commit: COMMIT, manifest: manifestAt("0.1.0-pre.7"), previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: "v0.1.0-pre.6" }),
    ).toEqual({ outcome: "failed", error: 'cannot read the remote\'s tags: "v0.1.0-pre.6" is not a git ls-remote tag line' });
  });
});

describe("runReleaseState printing a state", () => {
  it("prints the tag and state as workflow outputs, says why on standard error and exits 0", () => {
    expect(runWith({ arguments: [COMMIT, manifestAt("0.1.0-pre.7"), manifestAt("0.1.0-pre.6"), RELEASED_TAGS] })).toEqual({
      writes: [[{ text: "tag=v0.1.0-pre.7\nstate=unreleased\n" }]],
      errors: [[{ text: "release-state: this push changes the version to 0.1.0-pre.7 and the remote has no tag v0.1.0-pre.7, so it releases it.\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("says this push releases nothing when the version is unchanged, and exits 0", () => {
    expect(runWith({ arguments: [COMMIT, manifestAt("0.1.0-pre.6"), manifestAt("0.1.0-pre.6"), RELEASED_TAGS] })).toEqual({
      writes: [[{ text: "tag=v0.1.0-pre.6\nstate=version-unchanged\n" }]],
      errors: [[{ text: "release-state: this push leaves the version at 0.1.0-pre.6, so it releases nothing.\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("says this push releases nothing when the version is already released at this commit, and exits 0", () => {
    expect(runWith({ arguments: [COMMIT, manifestAt("0.1.0-pre.6"), manifestAt("0.1.0-pre.5"), RELEASED_TAGS] })).toEqual({
      writes: [[{ text: "tag=v0.1.0-pre.6\nstate=already-released\n" }]],
      errors: [[{ text: "release-state: the remote's tag v0.1.0-pre.6 already names this push's commit, so 0.1.0-pre.6 is released and this push releases nothing.\n" }]],
      exits: [[{ code: 0 }]],
    });
  });
});

describe("runReleaseState refusing", () => {
  it("exits 1 naming the problem when it cannot decide", () => {
    expect(runWith({ arguments: [COMMIT, manifestAt("1.0"), manifestAt("0.1.0-pre.6"), RELEASED_TAGS] })).toEqual({
      writes: [],
      errors: [
        [
          {
            text: "release-state: package.json's version 1.0 is not one this workflow releases: major.minor.patch, optionally followed by -<identifier>.<number>\n",
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("prints no workflow output for an unchanged version that would inject lines into it, and exits 1", () => {
    const injected = "0.1.0-pre.6\ntag=v9.9.9\nstate=unreleased\nx<<state=version-unchanged";

    expect(runWith({ arguments: [COMMIT, manifestAt(injected), manifestAt(injected), RELEASED_TAGS] })).toEqual({
      writes: [],
      errors: [
        [
          {
            text: `release-state: package.json's version ${injected} is not one this workflow releases: major.minor.patch, optionally followed by -<identifier>.<number>\n`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 2 with its usage when the commit is empty", () => {
    expect(runWith({ arguments: ["", manifestAt("0.1.0-pre.7"), manifestAt("0.1.0-pre.6"), RELEASED_TAGS] })).toEqual({
      writes: [],
      errors: [[{ text: "usage: release-state <commit> <package.json> <previous package.json> <git ls-remote tags>\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with its usage when an argument is missing", () => {
    expect(runWith({ arguments: [COMMIT, manifestAt("0.1.0-pre.7"), manifestAt("0.1.0-pre.6")] })).toEqual({
      writes: [],
      errors: [[{ text: "usage: release-state <commit> <package.json> <previous package.json> <git ls-remote tags>\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

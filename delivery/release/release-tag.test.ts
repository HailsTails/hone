import { describe, expect, it, vi } from "vitest";
import type { ProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { runReleaseTag } from "./release-tag.ts";

const COMMIT = "d32d2530312c64d2938aeab5753737e89f972e48";

const OTHER_COMMIT = "5c9edb1f0e0b2f5a0d6f3c1e9a8b7c6d5e4f3a2b";

const USAGE = "usage: release-tag <tag> <commit> <git ls-remote tags>\n";

const runWith = (request: { readonly arguments: readonly string[] }) => {
  const processPort: ProcessPort = {
    arguments: request.arguments,
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  };
  runReleaseTag({ process: processPort });
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    errors: vi.mocked(processPort.writeError).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

describe("runReleaseTag confirming the release's tag", () => {
  it("exits 0 when the remote's tag names this run's commit", () => {
    expect(runWith({ arguments: ["v0.1.0-pre.7", COMMIT, `${COMMIT}\trefs/tags/v0.1.0-pre.7`] })).toEqual({
      writes: [],
      errors: [[{ text: "release-tag: the remote's tag v0.1.0-pre.7 names this run's commit, so the release is recorded where it was built.\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("exits 1 and says what to do when the remote's tag names another commit", () => {
    expect(runWith({ arguments: ["v0.1.0-pre.7", COMMIT, `${OTHER_COMMIT}\trefs/tags/v0.1.0-pre.7`] })).toEqual({
      writes: [],
      errors: [
        [
          {
            text: `release-tag: the remote's tag v0.1.0-pre.7 names ${OTHER_COMMIT}, not this run's commit ${COMMIT}: the tag was made outside this workflow while it ran, and the GitHub release v0.1.0-pre.7 now holds this run's tarball on it. Nothing is staged on npm. Delete the GitHub release v0.1.0-pre.7, then release a new version with a new release pull request rather than re-running this run.\n`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 1 when the remote has no such tag", () => {
    expect(runWith({ arguments: ["v0.1.0-pre.7", COMMIT, `${COMMIT}\trefs/tags/v0.1.0-pre.6`] })).toEqual({
      writes: [],
      errors: [[{ text: "release-tag: the remote has no tag v0.1.0-pre.7 after the release was created, so nothing is staged on npm.\n" }]],
      exits: [[{ code: 1 }]],
    });
  });
});

describe("runReleaseTag refusing its input", () => {
  it("exits 1 when it cannot read the remote's tags", () => {
    expect(runWith({ arguments: ["v0.1.0-pre.7", COMMIT, "v0.1.0-pre.7"] })).toEqual({
      writes: [],
      errors: [[{ text: 'release-tag: cannot read the remote\'s tags: "v0.1.0-pre.7" is not a git ls-remote tag line\n' }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 2 with its usage when the commit is empty", () => {
    expect(runWith({ arguments: ["v0.1.0-pre.7", "", `${COMMIT}\trefs/tags/v0.1.0-pre.7`] })).toEqual({
      writes: [],
      errors: [[{ text: USAGE }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with its usage when an argument is missing", () => {
    expect(runWith({ arguments: ["v0.1.0-pre.7", COMMIT] })).toEqual({ writes: [], errors: [[{ text: USAGE }]], exits: [[{ code: 2 }]] });
  });
});

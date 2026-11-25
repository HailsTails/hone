import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { runSpeedSample, type SampleStages } from "./run-speed-sample.ts";

describe("runSpeedSample", () => {
  it("prepares the sample, times it with the side's command, then removes it", () => {
    const times = {
      cold: { cpuMicroseconds: 100, wallMilliseconds: 10 },
      warm: { cpuMicroseconds: 50, wallMilliseconds: 5 },
    };
    const install = {
      directory: absoluteRootOf("/work/head"),
      command: absoluteRootOf("/work/head/hone.js"),
      resolvedHone: "/work/head/node_modules/hone",
    };
    const prepareSample = vi.fn<SampleStages["prepareSample"]>().mockReturnValue({
      kind: "prepared",
      copy: absoluteRootOf("/work/head/samples/2"),
      temporaryFolder: absoluteRootOf("/work/head/samples/2/.tmp"),
      setUpMilliseconds: 2_000,
    });
    const timeSample = vi
      .fn<SampleStages["timeSample"]>()
      .mockReturnValue({ outcome: "ok", value: times });
    const removeSample = vi.fn<SampleStages["removeSample"]>().mockReturnValue([]);

    const sample = runSpeedSample({
      stages: { prepareSample, timeSample, removeSample },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      sampleIndex: 2,
      install,
      tree: "4b825dc6",
      baseRevision: "a4af1c897",
    });

    expect({
      sample,
      prepared: prepareSample.mock.calls,
      timed: timeSample.mock.calls,
      removed: removeSample.mock.calls,
    }).toEqual({
      sample: { kind: "measured", times, setUpMilliseconds: 2_000, leftovers: [] },
      prepared: [
        [
          {
            repo: "/work/large-repo",
            side: "head",
            sampleIndex: 2,
            install,
            tree: "4b825dc6",
          },
        ],
      ],
      timed: [
        [
          {
            temporaryFolder: "/work/head/samples/2/.tmp",
            command: "/work/head/hone.js",
            copy: "/work/head/samples/2",
            baseRevision: "a4af1c897",
          },
        ],
      ],
      removed: [[{ repo: "/work/large-repo", copy: "/work/head/samples/2" }]],
    });
  });

  it("removes the sample, keeping what it could not remove, when its check fails", () => {
    const install = {
      directory: absoluteRootOf("/work/head"),
      command: absoluteRootOf("/work/head/hone.js"),
      resolvedHone: "/work/head/node_modules/hone",
    };
    const sample = runSpeedSample({
      stages: {
        prepareSample: vi.fn<SampleStages["prepareSample"]>().mockReturnValue({
          kind: "prepared",
          copy: absoluteRootOf("/work/head/samples/0"),
          temporaryFolder: absoluteRootOf("/work/head/samples/0/.tmp"),
          setUpMilliseconds: 2_000,
        }),
        timeSample: vi.fn<SampleStages["timeSample"]>().mockReturnValue({
          outcome: "failed",
          error: { kind: "check-exited", status: 2, output: "crash" },
        }),
        removeSample: vi.fn<SampleStages["removeSample"]>().mockReturnValue([
          {
            kind: "directory-unremoved",
            directory: absoluteRootOf("/work/head/samples/0"),
            detail: "EBUSY",
          },
        ]),
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      sampleIndex: 0,
      install,
      tree: "4b825dc6",
      baseRevision: "a4af1c897",
    });

    expect(sample).toEqual({
      kind: "check-failed",
      failure: { kind: "check-exited", status: 2, output: "crash" },
      leftovers: [
        { kind: "directory-unremoved", directory: "/work/head/samples/0", detail: "EBUSY" },
      ],
    });
  });

  it("removes a sample it refused to time, and times nothing", () => {
    const install = {
      directory: absoluteRootOf("/work/head"),
      command: absoluteRootOf("/work/head/hone.js"),
      resolvedHone: "/work/head/node_modules/hone",
    };
    const timeSample = vi.fn<SampleStages["timeSample"]>();
    const removeSample = vi.fn<SampleStages["removeSample"]>().mockReturnValue([]);

    const sample = runSpeedSample({
      stages: {
        prepareSample: vi.fn<SampleStages["prepareSample"]>().mockReturnValue({
          kind: "unprepared",
          copy: absoluteRootOf("/work/head/samples/0"),
          refusal: {
            side: "head",
            failure: { kind: "package-manifest-unresolved", detail: "missing" },
          },
        }),
        timeSample,
        removeSample,
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      sampleIndex: 0,
      install,
      tree: "4b825dc6",
      baseRevision: "a4af1c897",
    });

    expect({ sample, timed: timeSample.mock.calls, removed: removeSample.mock.calls }).toEqual({
      sample: {
        kind: "unprepared",
        refusal: {
          side: "head",
          failure: { kind: "package-manifest-unresolved", detail: "missing" },
        },
        leftovers: [],
      },
      timed: [],
      removed: [[{ repo: "/work/large-repo", copy: "/work/head/samples/0" }]],
    });
  });

  it("removes nothing when no sample worktree could be placed", () => {
    const install = {
      directory: absoluteRootOf("/work/head"),
      command: absoluteRootOf("/work/head/hone.js"),
      resolvedHone: "/work/head/node_modules/hone",
    };
    const removeSample = vi.fn<SampleStages["removeSample"]>();

    const sample = runSpeedSample({
      stages: {
        prepareSample: vi.fn<SampleStages["prepareSample"]>().mockReturnValue({
          kind: "unplaced",
          refusal: { side: "head", failure: { kind: "target-copy-unresolved", path: "samples/0" } },
        }),
        timeSample: vi.fn<SampleStages["timeSample"]>(),
        removeSample,
      },
      repo: absoluteRootOf("/work/large-repo"),
      side: "head",
      sampleIndex: 0,
      install,
      tree: "4b825dc6",
      baseRevision: "a4af1c897",
    });

    expect({ sample, removed: removeSample.mock.calls }).toEqual({
      sample: {
        kind: "unprepared",
        refusal: { side: "head", failure: { kind: "target-copy-unresolved", path: "samples/0" } },
        leftovers: [],
      },
      removed: [],
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { runSpeedBaseline, type SpeedBaselinePhases } from "./run-speed-baseline.ts";
import type { SpeedBaselineArgumentsPort } from "./speed-baseline-arguments-port.ts";

describe("runSpeedBaseline", () => {
  it("hands the prepared installs, tree, pinned target base and pair count to measure", () => {
    const install = {
      directory: absoluteRootOf("/work/install"),
      command: absoluteRootOf("/work/install/hone.js"),
      resolvedHone: "/work/install/node_modules/hone",
    };
    const installs = { baseline: install, head: install };
    const measure = vi.fn<SpeedBaselinePhases["measure"]>().mockReturnValue({
      run: { kind: "unprepared", refusal: { side: "head", failure: { kind: "lockfile-missing" } } },
      setUpMilliseconds: [],
      leftovers: [],
    });

    runSpeedBaseline({
      ports: {
        arguments: {
          read: vi.fn<SpeedBaselineArgumentsPort["read"]>().mockReturnValue({
            outcome: "ok",
            value: { repo: absoluteRootOf("/work/large-repo"), mode: "compare" },
          }),
        },
      },
      phases: {
        prepare: vi.fn<SpeedBaselinePhases["prepare"]>().mockReturnValue({
          prepared: {
            outcome: "ok",
            value: { installs, tree: "4b825dc6", made: { installs: [], checkouts: [] } },
          },
          leftovers: [],
        }),
        measure,
        cleanUp: vi.fn<SpeedBaselinePhases["cleanUp"]>().mockReturnValue([]),
      },
      configuration: {
        baselineRevision: "v2.0.0-pre.4",
        targetBaseRevision: "a4af1c897",
        allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
        pairCount: 5,
      },
    });

    expect(measure.mock.calls).toEqual([
      [
        {
          repo: "/work/large-repo",
          installs,
          tree: "4b825dc6",
          baseRevision: "a4af1c897",
          pairCount: 5,
        },
      ],
    ]);
  });

  it("hands clean-up what was prepared once the pairs end", () => {
    const install = {
      directory: absoluteRootOf("/work/install"),
      command: absoluteRootOf("/work/install/hone.js"),
      resolvedHone: "/work/install/node_modules/hone",
    };
    const cleanUp = vi.fn<SpeedBaselinePhases["cleanUp"]>().mockReturnValue([]);

    runSpeedBaseline({
      ports: {
        arguments: {
          read: vi.fn<SpeedBaselineArgumentsPort["read"]>().mockReturnValue({
            outcome: "ok",
            value: { repo: absoluteRootOf("/work/large-repo"), mode: "compare" },
          }),
        },
      },
      phases: {
        prepare: vi.fn<SpeedBaselinePhases["prepare"]>().mockReturnValue({
          prepared: {
            outcome: "ok",
            value: {
              installs: { baseline: install, head: install },
              tree: "4b825dc6",
              made: {
                installs: [install.directory],
                checkouts: [absoluteRootOf("/work/baseline")],
              },
            },
          },
          leftovers: [],
        }),
        measure: vi.fn<SpeedBaselinePhases["measure"]>().mockReturnValue({
          run: {
            kind: "unprepared",
            refusal: { side: "head", failure: { kind: "lockfile-missing" } },
          },
          setUpMilliseconds: [],
          leftovers: [],
        }),
        cleanUp,
      },
      configuration: {
        baselineRevision: "v2.0.0-pre.4",
        targetBaseRevision: "a4af1c897",
        allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
        pairCount: 5,
      },
    });

    expect(cleanUp.mock.calls).toEqual([
      [{ repo: "/work/large-repo", installs: ["/work/install"], checkouts: ["/work/baseline"] }],
    ]);
  });

  it("reports the preparation's, the pairs' and the clean-up's leftovers in that order", () => {
    const install = {
      directory: absoluteRootOf("/work/install"),
      command: absoluteRootOf("/work/install/hone.js"),
      resolvedHone: "/work/install/node_modules/hone",
    };

    const outcome = runSpeedBaseline({
      ports: {
        arguments: {
          read: vi.fn<SpeedBaselineArgumentsPort["read"]>().mockReturnValue({
            outcome: "ok",
            value: { repo: absoluteRootOf("/work/large-repo"), mode: "compare" },
          }),
        },
      },
      phases: {
        prepare: vi.fn<SpeedBaselinePhases["prepare"]>().mockReturnValue({
          prepared: {
            outcome: "ok",
            value: {
              installs: { baseline: install, head: install },
              tree: "4b825dc6",
              made: { installs: [], checkouts: [] },
            },
          },
          leftovers: [
            { kind: "directory-unremoved", directory: absoluteRootOf("/i"), detail: "EPERM" },
          ],
        }),
        measure: vi.fn<SpeedBaselinePhases["measure"]>().mockReturnValue({
          run: {
            kind: "unprepared",
            refusal: { side: "head", failure: { kind: "lockfile-missing" } },
          },
          setUpMilliseconds: [],
          leftovers: [
            { kind: "directory-unremoved", directory: absoluteRootOf("/s"), detail: "EBUSY" },
          ],
        }),
        cleanUp: vi
          .fn<SpeedBaselinePhases["cleanUp"]>()
          .mockReturnValue([
            { kind: "directory-unremoved", directory: absoluteRootOf("/b"), detail: "EBUSY" },
          ]),
      },
      configuration: {
        baselineRevision: "v2.0.0-pre.4",
        targetBaseRevision: "a4af1c897",
        allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
        pairCount: 5,
      },
    });

    expect(outcome).toEqual({
      kind: "unprepared",
      refusal: { side: "head", failure: { kind: "lockfile-missing" } },
      leftovers: [
        { kind: "directory-unremoved", directory: "/i", detail: "EPERM" },
        { kind: "directory-unremoved", directory: "/s", detail: "EBUSY" },
        { kind: "directory-unremoved", directory: "/b", detail: "EBUSY" },
      ],
    });
  });
  it("measures nothing and reports the preparation's refusal when the sides cannot be prepared", () => {
    const measure = vi.fn<SpeedBaselinePhases["measure"]>();
    const prepare = vi.fn<SpeedBaselinePhases["prepare"]>().mockReturnValue({
      prepared: {
        outcome: "failed",
        error: { side: "baseline", failure: { kind: "lockfile-missing" } },
      },
      leftovers: [
        { kind: "directory-unremoved", directory: absoluteRootOf("/work/index"), detail: "EPERM" },
      ],
    });

    const outcome = runSpeedBaseline({
      ports: {
        arguments: {
          read: vi.fn<SpeedBaselineArgumentsPort["read"]>().mockReturnValue({
            outcome: "ok",
            value: { repo: absoluteRootOf("/work/large-repo"), mode: "calibrate" },
          }),
        },
      },
      phases: { prepare, measure, cleanUp: vi.fn<SpeedBaselinePhases["cleanUp"]>() },
      configuration: {
        baselineRevision: "v2.0.0-pre.4",
        targetBaseRevision: "a4af1c897",
        allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
        pairCount: 5,
      },
    });

    expect({ outcome, prepared: prepare.mock.calls, measured: measure.mock.calls }).toEqual({
      outcome: {
        kind: "unprepared",
        refusal: { side: "baseline", failure: { kind: "lockfile-missing" } },
        leftovers: [{ kind: "directory-unremoved", directory: "/work/index", detail: "EPERM" }],
      },
      prepared: [[{ repo: "/work/large-repo", mode: "calibrate", revision: "v2.0.0-pre.4" }]],
      measured: [],
    });
  });

  it("refuses the usage and runs no phase when the command line is refused", () => {
    const prepare = vi.fn<SpeedBaselinePhases["prepare"]>();

    const outcome = runSpeedBaseline({
      ports: {
        arguments: {
          read: vi.fn<SpeedBaselineArgumentsPort["read"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "usage-refused", detail: "Missing --repo", usage: "usage\n" },
          }),
        },
      },
      phases: {
        prepare,
        measure: vi.fn<SpeedBaselinePhases["measure"]>(),
        cleanUp: vi.fn<SpeedBaselinePhases["cleanUp"]>(),
      },
      configuration: {
        baselineRevision: "v2.0.0-pre.4",
        targetBaseRevision: "a4af1c897",
        allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
        pairCount: 5,
      },
    });

    expect({ outcome, prepared: prepare.mock.calls }).toEqual({
      outcome: {
        kind: "usage-refused",
        refusal: { kind: "usage-refused", detail: "Missing --repo", usage: "usage\n" },
      },
      prepared: [],
    });
  });
});

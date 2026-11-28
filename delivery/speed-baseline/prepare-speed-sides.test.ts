import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { type PrepareStages, prepareSpeedSides } from "./prepare-speed-sides.ts";

describe("prepareSpeedSides", () => {
  it("hands the tarballs and the target tree to the installs", () => {
    const tarballs = {
      baseline: absoluteRootOf("/work/b.tgz"),
      head: absoluteRootOf("/work/h.tgz"),
    };
    const writeSideInstalls = vi.fn<PrepareStages["writeSideInstalls"]>().mockReturnValue({
      directories: [],
      installs: {
        outcome: "failed",
        error: { side: "head", failure: { kind: "lockfile-missing" } },
      },
    });

    prepareSpeedSides({
      stages: {
        readTargetTree: vi
          .fn<PrepareStages["readTargetTree"]>()
          .mockReturnValue({ tree: { outcome: "ok", value: "4b825dc6" }, leftovers: [] }),
        writeTarballs: vi
          .fn<PrepareStages["writeTarballs"]>()
          .mockReturnValue({ checkouts: [], tarballs: { outcome: "ok", value: tarballs } }),
        writeSideInstalls,
        cleanUp: vi.fn<PrepareStages["cleanUp"]>().mockReturnValue([]),
      },
      repo: absoluteRootOf("/work/large-repo"),
      mode: "compare",
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
    });

    expect(writeSideInstalls.mock.calls).toEqual([
      [{ repo: "/work/large-repo", tarballs, tree: "4b825dc6" }],
    ]);
  });

  it("hands back the installs, the tree and what it made, with the tree's leftovers", () => {
    const install = {
      directory: absoluteRootOf("/work/install"),
      command: absoluteRootOf("/work/install/hone.js"),
      resolvedHone: "/work/install/node_modules/hone",
    };

    const preparation = prepareSpeedSides({
      stages: {
        readTargetTree: vi.fn<PrepareStages["readTargetTree"]>().mockReturnValue({
          tree: { outcome: "ok", value: "4b825dc6" },
          leftovers: [
            {
              kind: "directory-unremoved",
              directory: absoluteRootOf("/work/index"),
              detail: "EPERM",
            },
          ],
        }),
        writeTarballs: vi.fn<PrepareStages["writeTarballs"]>().mockReturnValue({
          checkouts: [absoluteRootOf("/work/baseline")],
          tarballs: {
            outcome: "ok",
            value: { baseline: absoluteRootOf("/b.tgz"), head: absoluteRootOf("/h.tgz") },
          },
        }),
        writeSideInstalls: vi.fn<PrepareStages["writeSideInstalls"]>().mockReturnValue({
          directories: [install.directory],
          installs: { outcome: "ok", value: { baseline: install, head: install } },
        }),
        cleanUp: vi.fn<PrepareStages["cleanUp"]>(),
      },
      repo: absoluteRootOf("/work/large-repo"),
      mode: "compare",
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
    });

    expect(preparation).toEqual({
      prepared: {
        outcome: "ok",
        value: {
          installs: { baseline: install, head: install },
          tree: "4b825dc6",
          made: { installs: ["/work/install"], checkouts: ["/work/baseline"] },
        },
      },
      leftovers: [{ kind: "directory-unremoved", directory: "/work/index", detail: "EPERM" }],
    });
  });

  it("removes what the installs made, and hands back the refusal, when a side cannot be installed", () => {
    const cleanUp = vi.fn<PrepareStages["cleanUp"]>().mockReturnValue([]);

    const preparation = prepareSpeedSides({
      stages: {
        readTargetTree: vi
          .fn<PrepareStages["readTargetTree"]>()
          .mockReturnValue({ tree: { outcome: "ok", value: "4b825dc6" }, leftovers: [] }),
        writeTarballs: vi.fn<PrepareStages["writeTarballs"]>().mockReturnValue({
          checkouts: [absoluteRootOf("/work/baseline")],
          tarballs: {
            outcome: "ok",
            value: { baseline: absoluteRootOf("/b.tgz"), head: absoluteRootOf("/h.tgz") },
          },
        }),
        writeSideInstalls: vi.fn<PrepareStages["writeSideInstalls"]>().mockReturnValue({
          directories: [absoluteRootOf("/work/install/baseline")],
          installs: {
            outcome: "failed",
            error: { side: "baseline", failure: { kind: "lockfile-missing" } },
          },
        }),
        cleanUp,
      },
      repo: absoluteRootOf("/work/large-repo"),
      mode: "compare",
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
    });

    expect({ preparation, removed: cleanUp.mock.calls }).toEqual({
      preparation: {
        prepared: {
          outcome: "failed",
          error: { side: "baseline", failure: { kind: "lockfile-missing" } },
        },
        leftovers: [],
      },
      removed: [
        [
          {
            repo: "/work/large-repo",
            installs: ["/work/install/baseline"],
            checkouts: ["/work/baseline"],
          },
        ],
      ],
    });
  });

  it("packs the pinned baseline revision in the mode it is asked for", () => {
    const writeTarballs = vi.fn<PrepareStages["writeTarballs"]>().mockReturnValue({
      checkouts: [],
      tarballs: {
        outcome: "failed",
        error: { side: "baseline", failure: { kind: "tarball-unnamed", output: "" } },
      },
    });

    prepareSpeedSides({
      stages: {
        readTargetTree: vi
          .fn<PrepareStages["readTargetTree"]>()
          .mockReturnValue({ tree: { outcome: "ok", value: "4b825dc6" }, leftovers: [] }),
        writeTarballs,
        writeSideInstalls: vi.fn<PrepareStages["writeSideInstalls"]>(),
        cleanUp: vi.fn<PrepareStages["cleanUp"]>().mockReturnValue([]),
      },
      repo: absoluteRootOf("/work/large-repo"),
      mode: "calibrate",
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
    });

    expect(writeTarballs.mock.calls).toEqual([
      [{ revision: "v2.0.0-pre.4", headRoot: "/work/hone", mode: "calibrate" }],
    ]);
  });

  it("removes the checkout, and installs nothing, when a tarball cannot be packed", () => {
    const cleanUp = vi.fn<PrepareStages["cleanUp"]>().mockReturnValue([]);
    const writeSideInstalls = vi.fn<PrepareStages["writeSideInstalls"]>();

    const preparation = prepareSpeedSides({
      stages: {
        readTargetTree: vi
          .fn<PrepareStages["readTargetTree"]>()
          .mockReturnValue({ tree: { outcome: "ok", value: "4b825dc6" }, leftovers: [] }),
        writeTarballs: vi.fn<PrepareStages["writeTarballs"]>().mockReturnValue({
          checkouts: [absoluteRootOf("/work/baseline")],
          tarballs: {
            outcome: "failed",
            error: { side: "head", failure: { kind: "tarball-unnamed", output: "" } },
          },
        }),
        writeSideInstalls,
        cleanUp,
      },
      repo: absoluteRootOf("/work/large-repo"),
      mode: "compare",
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
    });

    expect({
      preparation,
      removed: cleanUp.mock.calls,
      installed: writeSideInstalls.mock.calls,
    }).toEqual({
      preparation: {
        prepared: {
          outcome: "failed",
          error: { side: "head", failure: { kind: "tarball-unnamed", output: "" } },
        },
        leftovers: [],
      },
      removed: [[{ repo: "/work/large-repo", installs: [], checkouts: ["/work/baseline"] }]],
      installed: [],
    });
  });

  it("packs nothing when the target's tree cannot be read, and hands back what the tree left", () => {
    const writeTarballs = vi.fn<PrepareStages["writeTarballs"]>();

    const preparation = prepareSpeedSides({
      stages: {
        readTargetTree: vi.fn<PrepareStages["readTargetTree"]>().mockReturnValue({
          tree: {
            outcome: "failed",
            error: {
              side: "target",
              failure: {
                kind: "target-index-directory-uncreatable",
                detail: "temporary root unavailable",
              },
            },
          },
          leftovers: [
            {
              kind: "directory-unremoved",
              directory: absoluteRootOf("/work/index"),
              detail: "EPERM",
            },
          ],
        }),
        writeTarballs,
        writeSideInstalls: vi.fn<PrepareStages["writeSideInstalls"]>(),
        cleanUp: vi.fn<PrepareStages["cleanUp"]>(),
      },
      repo: absoluteRootOf("/work/large-repo"),
      mode: "compare",
      revision: "v2.0.0-pre.4",
      headRoot: absoluteRootOf("/work/hone"),
    });

    expect({ preparation, packed: writeTarballs.mock.calls }).toEqual({
      preparation: {
        prepared: {
          outcome: "failed",
          error: {
            side: "target",
            failure: {
              kind: "target-index-directory-uncreatable",
              detail: "temporary root unavailable",
            },
          },
        },
        leftovers: [{ kind: "directory-unremoved", directory: "/work/index", detail: "EPERM" }],
      },
      packed: [],
    });
  });
});

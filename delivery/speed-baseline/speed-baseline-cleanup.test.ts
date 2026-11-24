import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { BaselineCheckoutPort } from "./baseline-checkout-port.ts";
import type { DirectoryRemovalPort } from "./directory-removal-port.ts";
import { removeSpeedLeftovers, removeSpeedSides } from "./speed-baseline-cleanup.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";

describe("removeSpeedLeftovers", () => {
  it("removes both sides' install worktrees and the baseline checkout under their fixed names", () => {
    const copiesRead = vi
      .fn<TargetCopyPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: absoluteRootOf("/work/install/baseline") })
      .mockReturnValueOnce({ outcome: "ok", value: absoluteRootOf("/work/install/head") });
    const directoriesRemove = vi
      .fn<DirectoryRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: null });

    const removed = removeSpeedLeftovers({
      ports: {
        copies: {
          read: copiesRead,
          write: vi.fn<TargetCopyPort["write"]>(),
          remove: vi.fn<TargetCopyPort["remove"]>().mockReturnValue({ outcome: "ok", value: null }),
        },
        checkouts: {
          read: vi
            .fn<BaselineCheckoutPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/baseline") }),
          write: vi.fn<BaselineCheckoutPort["write"]>(),
          remove: vi
            .fn<BaselineCheckoutPort["remove"]>()
            .mockReturnValue({ outcome: "ok", value: null }),
        },
        directories: { remove: directoriesRemove },
      },
      repo: absoluteRootOf("/work/large-repo"),
      revision: "v2.0.0-pre.4",
    });

    expect({
      removed,
      places: copiesRead.mock.calls,
      folders: directoriesRemove.mock.calls,
    }).toEqual({
      removed: { outcome: "ok", value: null },
      places: [
        [{ repo: "/work/large-repo", place: { kind: "install", side: "baseline" } }],
        [{ repo: "/work/large-repo", place: { kind: "install", side: "head" } }],
      ],
      folders: [
        [{ directory: "/work/install/baseline" }],
        [{ directory: "/work/install/head" }],
        [{ directory: "/work/baseline" }],
      ],
    });
  });

  it("refuses for the side whose leftover install cannot be removed, and goes no further", () => {
    const copiesRead = vi
      .fn<TargetCopyPort["read"]>()
      .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/install/baseline") });

    const removed = removeSpeedLeftovers({
      ports: {
        copies: {
          read: copiesRead,
          write: vi.fn<TargetCopyPort["write"]>(),
          remove: vi.fn<TargetCopyPort["remove"]>().mockReturnValue({ outcome: "ok", value: null }),
        },
        checkouts: {
          read: vi.fn<BaselineCheckoutPort["read"]>(),
          write: vi.fn<BaselineCheckoutPort["write"]>(),
          remove: vi.fn<BaselineCheckoutPort["remove"]>(),
        },
        directories: {
          remove: vi.fn<DirectoryRemovalPort["remove"]>().mockReturnValue({
            outcome: "failed",
            error: {
              kind: "directory-unremoved",
              directory: absoluteRootOf("/work/install/baseline"),
              detail: "EBUSY",
            },
          }),
        },
      },
      repo: absoluteRootOf("/work/large-repo"),
      revision: "v2.0.0-pre.4",
    });

    expect({ removed, places: copiesRead.mock.calls.length }).toEqual({
      removed: {
        outcome: "failed",
        error: {
          side: "baseline",
          failure: {
            kind: "directory-unremoved",
            directory: "/work/install/baseline",
            detail: "EBUSY",
          },
        },
      },
      places: 1,
    });
  });
});

describe("removeSpeedSides", () => {
  it("removes the installs in reverse, then the checkouts, keeping what it could not remove", () => {
    const copiesRemove = vi
      .fn<TargetCopyPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: null });
    const checkoutsRemove = vi.fn<BaselineCheckoutPort["remove"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "baseline-unremoved",
        directory: absoluteRootOf("/work/baseline"),
        command: { kind: "exited", status: 128, output: "fatal" },
      },
    });

    const leftovers = removeSpeedSides({
      ports: {
        copies: {
          read: vi.fn<TargetCopyPort["read"]>(),
          write: vi.fn<TargetCopyPort["write"]>(),
          remove: copiesRemove,
        },
        checkouts: {
          read: vi.fn<BaselineCheckoutPort["read"]>(),
          write: vi.fn<BaselineCheckoutPort["write"]>(),
          remove: checkoutsRemove,
        },
        directories: {
          remove: vi
            .fn<DirectoryRemovalPort["remove"]>()
            .mockReturnValue({ outcome: "ok", value: null }),
        },
      },
      repo: absoluteRootOf("/work/large-repo"),
      installs: [absoluteRootOf("/work/install/baseline"), absoluteRootOf("/work/install/head")],
      checkouts: [absoluteRootOf("/work/baseline")],
    });

    expect({ leftovers, copies: copiesRemove.mock.calls }).toEqual({
      leftovers: [
        {
          kind: "baseline-unremoved",
          directory: "/work/baseline",
          command: { kind: "exited", status: 128, output: "fatal" },
        },
      ],
      copies: [
        [{ repo: "/work/large-repo", directory: "/work/install/head" }],
        [{ repo: "/work/large-repo", directory: "/work/install/baseline" }],
      ],
    });
  });
});

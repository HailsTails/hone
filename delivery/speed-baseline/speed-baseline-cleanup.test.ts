import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { BaselineCheckoutPort } from "./baseline-checkout-port.ts";
import type { DirectoryRemovalPort } from "./directory-removal-port.ts";
import { removeSpeedSides } from "./speed-baseline-cleanup.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";

describe("removeSpeedSides", () => {
  it("removes the installs in reverse, then the checkouts, keeping the folder of a checkout git still holds", () => {
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

    const directoriesRemove = vi
      .fn<DirectoryRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: null });

    const leftovers = removeSpeedSides({
      ports: {
        copies: {
          remove: copiesRemove,
        },
        checkouts: {
          remove: checkoutsRemove,
        },
        directories: { remove: directoriesRemove },
      },
      repo: absoluteRootOf("/work/large-repo"),
      installs: [absoluteRootOf("/work/install/baseline"), absoluteRootOf("/work/install/head")],
      checkouts: [absoluteRootOf("/work/baseline")],
    });

    expect({
      leftovers,
      copies: copiesRemove.mock.calls,
      folders: directoriesRemove.mock.calls,
    }).toEqual({
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
      folders: [[{ directory: "/work/install/head" }], [{ directory: "/work/install/baseline" }]],
    });
  });

  it("removes a checkout's folder once git let it go, reporting one it could not remove", () => {
    const leftovers = removeSpeedSides({
      ports: {
        copies: { remove: vi.fn<TargetCopyPort["remove"]>() },
        checkouts: {
          remove: vi
            .fn<BaselineCheckoutPort["remove"]>()
            .mockReturnValue({ outcome: "ok", value: null }),
        },
        directories: {
          remove: vi.fn<DirectoryRemovalPort["remove"]>().mockReturnValue({
            outcome: "failed",
            error: {
              kind: "directory-unremoved",
              directory: absoluteRootOf("/work/baseline"),
              detail: "EBUSY",
            },
          }),
        },
      },
      repo: absoluteRootOf("/work/large-repo"),
      installs: [],
      checkouts: [absoluteRootOf("/work/baseline")],
    });

    expect(leftovers).toEqual([
      { kind: "directory-unremoved", directory: "/work/baseline", detail: "EBUSY" },
    ]);
  });
});

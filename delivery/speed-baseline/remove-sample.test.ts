import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { DirectoryRemovalPort } from "./directory-removal-port.ts";
import { removeTargetCopy } from "./remove-sample.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";

describe("removeTargetCopy", () => {
  it("unregisters the worktree and removes its folder", () => {
    const copiesRemove = vi
      .fn<TargetCopyPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: null });
    const directoriesRemove = vi
      .fn<DirectoryRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: null });

    const leftovers = removeTargetCopy({
      ports: {
        copies: {
          read: vi.fn<TargetCopyPort["read"]>(),
          write: vi.fn<TargetCopyPort["write"]>(),
          remove: copiesRemove,
        },
        directories: { remove: directoriesRemove },
      },
      repo: absoluteRootOf("/work/large-repo"),
      copy: absoluteRootOf("/work/head/samples/0"),
    });

    expect({
      leftovers,
      unregistered: copiesRemove.mock.calls,
      removed: directoriesRemove.mock.calls,
    }).toEqual({
      leftovers: [],
      unregistered: [[{ repo: "/work/large-repo", directory: "/work/head/samples/0" }]],
      removed: [[{ directory: "/work/head/samples/0" }]],
    });
  });

  it("still removes the folder, keeping both failures, when neither removal succeeds", () => {
    const leftovers = removeTargetCopy({
      ports: {
        copies: {
          read: vi.fn<TargetCopyPort["read"]>(),
          write: vi.fn<TargetCopyPort["write"]>(),
          remove: vi.fn<TargetCopyPort["remove"]>().mockReturnValue({
            outcome: "failed",
            error: {
              kind: "target-copy-unremoved",
              directory: absoluteRootOf("/work/sample"),
              command: { kind: "exited", status: 128, output: "fatal" },
            },
          }),
        },
        directories: {
          remove: vi.fn<DirectoryRemovalPort["remove"]>().mockReturnValue({
            outcome: "failed",
            error: {
              kind: "directory-unremoved",
              directory: absoluteRootOf("/work/sample"),
              detail: "EBUSY",
            },
          }),
        },
      },
      repo: absoluteRootOf("/work/large-repo"),
      copy: absoluteRootOf("/work/sample"),
    });

    expect(leftovers).toEqual([
      {
        kind: "target-copy-unremoved",
        directory: "/work/sample",
        command: { kind: "exited", status: 128, output: "fatal" },
      },
      { kind: "directory-unremoved", directory: "/work/sample", detail: "EBUSY" },
    ]);
  });
});

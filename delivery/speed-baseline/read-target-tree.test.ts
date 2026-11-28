import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { IndexRemovalPort } from "./index-removal-port.ts";
import { readTargetTree } from "./read-target-tree.ts";
import type { TargetIndexPort } from "./target-index-port.ts";
import type { TargetTreePort } from "./target-tree-port.ts";

describe("readTargetTree", () => {
  it("writes the target's working state as one tree through a temporary index, then removes the index", () => {
    const treesRead = vi
      .fn<TargetTreePort["read"]>()
      .mockReturnValue({ outcome: "ok", value: "4b825dc6" });
    const indexRemove = vi
      .fn<IndexRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: null });

    const target = readTargetTree({
      ports: {
        indexes: {
          read: vi.fn<TargetIndexPort["read"]>().mockReturnValue({
            outcome: "ok",
            value: absoluteRootOf("/work/large-repo/.git/speed"),
          }),
        },
        trees: { read: treesRead, write: vi.fn<TargetTreePort["write"]>() },
        indexRemovals: { remove: indexRemove },
      },
      repo: absoluteRootOf("/work/large-repo"),
    });

    expect({ target, read: treesRead.mock.calls, removed: indexRemove.mock.calls }).toEqual({
      target: { tree: { outcome: "ok", value: "4b825dc6" }, leftovers: [] },
      read: [[{ repo: "/work/large-repo", index: "/work/large-repo/.git/speed" }]],
      removed: [[{ index: "/work/large-repo/.git/speed" }]],
    });
  });

  it("still removes the index when the tree cannot be written, keeping a failed removal as a leftover", () => {
    const indexRemove = vi.fn<IndexRemovalPort["remove"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "index-unremoved", index: absoluteRootOf("/work/index"), detail: "EPERM" },
    });

    const target = readTargetTree({
      ports: {
        indexes: {
          read: vi
            .fn<TargetIndexPort["read"]>()
            .mockReturnValue({ outcome: "ok", value: absoluteRootOf("/work/index") }),
        },
        trees: {
          read: vi.fn<TargetTreePort["read"]>().mockReturnValue({
            outcome: "failed",
            error: {
              kind: "target-tree-unread",
              command: { kind: "exited", status: 128, output: "fatal" },
            },
          }),
          write: vi.fn<TargetTreePort["write"]>(),
        },
        indexRemovals: { remove: indexRemove },
      },
      repo: absoluteRootOf("/work/large-repo"),
    });

    expect({ target, removed: indexRemove.mock.calls }).toEqual({
      target: {
        tree: {
          outcome: "failed",
          error: {
            side: "target",
            failure: {
              kind: "target-tree-unread",
              command: { kind: "exited", status: 128, output: "fatal" },
            },
          },
        },
        leftovers: [{ kind: "index-unremoved", index: "/work/index", detail: "EPERM" }],
      },
      removed: [[{ index: "/work/index" }]],
    });
  });

  it("reads no tree and removes nothing when the index cannot be named", () => {
    const treesRead = vi.fn<TargetTreePort["read"]>();

    const target = readTargetTree({
      ports: {
        indexes: {
          read: vi.fn<TargetIndexPort["read"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "target-index-unresolved", path: "relative/index" },
          }),
        },
        trees: { read: treesRead, write: vi.fn<TargetTreePort["write"]>() },
        indexRemovals: { remove: vi.fn<IndexRemovalPort["remove"]>() },
      },
      repo: absoluteRootOf("/work/large-repo"),
    });

    expect({ target, read: treesRead.mock.calls }).toEqual({
      target: {
        tree: {
          outcome: "failed",
          error: {
            side: "target",
            failure: { kind: "target-index-unresolved", path: "relative/index" },
          },
        },
        leftovers: [],
      },
      read: [],
    });
  });
});

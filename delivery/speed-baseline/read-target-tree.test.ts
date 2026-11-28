import { describe, expect, it, vi } from "vitest";

import type { TemporaryDirectoryPort } from "../../src/application/ports/file-system/temporary-directory-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { DirectoryRemovalPort } from "./directory-removal-port.ts";
import { readTargetTree } from "./read-target-tree.ts";
import type { TargetTreePort } from "./target-tree-port.ts";

describe("readTargetTree", () => {
  it("allocates a directory outside the target, reads its tree, and removes that directory", () => {
    const createIndexDirectory = vi.fn<TemporaryDirectoryPort["write"]>().mockReturnValue({
      outcome: "ok",
      value: absoluteRootOf("/tmp/hone-w12"),
    });
    const read = vi
      .fn<TargetTreePort["read"]>()
      .mockReturnValue({ outcome: "ok", value: "4b825dc6" });
    const remove = vi
      .fn<DirectoryRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: null });

    const target = readTargetTree({
      ports: {
        indexDirectories: { write: createIndexDirectory },
        trees: { read },
        directories: { remove },
      },
      repo: absoluteRootOf("/work/large-repo"),
    });

    expect({
      target,
      created: createIndexDirectory.mock.calls,
      read: read.mock.calls,
      removed: remove.mock.calls,
    }).toEqual({
      target: { tree: { outcome: "ok", value: "4b825dc6" }, leftovers: [] },
      created: [[{ outside: "/work/large-repo" }]],
      read: [[{ repo: "/work/large-repo", indexDirectory: "/tmp/hone-w12" }]],
      removed: [[{ directory: "/tmp/hone-w12" }]],
    });
  });

  it("reports the directory when a tree read and its directory cleanup both fail", () => {
    const createIndexDirectory = vi.fn<TemporaryDirectoryPort["write"]>().mockReturnValue({
      outcome: "ok",
      value: absoluteRootOf("/tmp/hone-w12"),
    });
    const read = vi.fn<TargetTreePort["read"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "target-tree-unread",
        command: { kind: "exited", status: 128, output: "fatal" },
      },
    });
    const remove = vi.fn<DirectoryRemovalPort["remove"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "directory-unremoved",
        directory: absoluteRootOf("/tmp/hone-w12"),
        detail: "EPERM",
      },
    });

    const target = readTargetTree({
      ports: {
        indexDirectories: { write: createIndexDirectory },
        trees: { read },
        directories: { remove },
      },
      repo: absoluteRootOf("/work/large-repo"),
    });

    expect({ target, removed: remove.mock.calls }).toEqual({
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
        leftovers: [{ kind: "directory-unremoved", directory: "/tmp/hone-w12", detail: "EPERM" }],
      },
      removed: [[{ directory: "/tmp/hone-w12" }]],
    });
  });

  it("reads no tree and removes nothing when allocation fails", () => {
    const createIndexDirectory = vi.fn<TemporaryDirectoryPort["write"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "temporary-directory-uncreatable", detail: "temporary root unavailable" },
    });
    const read = vi.fn<TargetTreePort["read"]>();
    const remove = vi.fn<DirectoryRemovalPort["remove"]>();

    const target = readTargetTree({
      ports: {
        indexDirectories: { write: createIndexDirectory },
        trees: { read },
        directories: { remove },
      },
      repo: absoluteRootOf("/work/large-repo"),
    });

    expect({ target, read: read.mock.calls, removed: remove.mock.calls }).toEqual({
      target: {
        tree: {
          outcome: "failed",
          error: {
            side: "target",
            failure: {
              kind: "temporary-directory-uncreatable",
              detail: "temporary root unavailable",
            },
          },
        },
        leftovers: [],
      },
      read: [],
      removed: [],
    });
  });
});

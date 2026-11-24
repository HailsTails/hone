import { describe, expect, it, vi } from "vitest";

import type { DirectoryTreePort } from "../../src/application/ports/file-system/directory-tree-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { createDirectoryRemovalPort } from "./directory-removal-adapter.ts";

describe("createDirectoryRemovalPort remove", () => {
  it("removes the whole directory", () => {
    const remove = vi
      .fn<DirectoryTreePort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: undefined });
    const directories = createDirectoryRemovalPort({ tree: { remove } });

    const removed = directories.remove({ directory: absoluteRootOf("/work/copy") });

    expect({ removed, tree: remove.mock.calls }).toEqual({
      removed: { outcome: "ok", value: null },
      tree: [[{ path: "/work/copy" }]],
    });
  });

  it("names the directory it could not remove", () => {
    const remove = vi.fn<DirectoryTreePort["remove"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "directory-tree-unremovable",
        path: absoluteRootOf("/work/copy"),
        detail: "EBUSY",
      },
    });
    const directories = createDirectoryRemovalPort({ tree: { remove } });

    const removed = directories.remove({ directory: absoluteRootOf("/work/copy") });

    expect(removed).toEqual({
      outcome: "failed",
      error: { kind: "directory-unremoved", directory: "/work/copy", detail: "EBUSY" },
    });
  });
});

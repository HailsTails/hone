import { describe, expect, it, vi } from "vitest";

import type { FileRemovalPort } from "../../src/application/ports/file-system/file-removal-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { createIndexRemovalPort } from "./index-removal-adapter.ts";

describe("createIndexRemovalPort remove", () => {
  it("removes the temporary index file", () => {
    const remove = vi
      .fn<FileRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: undefined });
    const indexRemovals = createIndexRemovalPort({ files: { remove } });

    const removed = indexRemovals.remove({
      index: absoluteRootOf("/work/large-repo/.git/hone-speed-baseline-index"),
    });

    expect({ removed, files: remove.mock.calls }).toEqual({
      removed: { outcome: "ok", value: null },
      files: [[{ path: "/work/large-repo/.git/hone-speed-baseline-index" }]],
    });
  });

  it("names the index it could not remove", () => {
    const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "unremovable",
        path: "/work/large-repo/.git/hone-speed-baseline-index",
        detail: "EPERM",
      },
    });
    const indexRemovals = createIndexRemovalPort({ files: { remove } });

    const removed = indexRemovals.remove({
      index: absoluteRootOf("/work/large-repo/.git/hone-speed-baseline-index"),
    });

    expect(removed).toEqual({
      outcome: "failed",
      error: {
        kind: "index-unremoved",
        index: "/work/large-repo/.git/hone-speed-baseline-index",
        detail: "EPERM",
      },
    });
  });
});

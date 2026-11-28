import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../src/application/ports/file-system/directory-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { createLockfilesPort } from "./lockfiles-adapter.ts";

describe("createLockfilesPort read", () => {
  it("reads the names of the files at the top of the copy", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [
        { name: "bun.lock", kind: "file" },
        { name: "package.json", kind: "file" },
        { name: "node_modules", kind: "directory" },
      ],
    });
    const lockfiles = createLockfilesPort({ directories: { list } });

    const read = lockfiles.read({ directory: absoluteRootOf("/work/copy") });

    expect({ read, listed: list.mock.calls }).toEqual({
      read: { outcome: "ok", value: ["bun.lock", "package.json"] },
      listed: [[{ path: "/work/copy" }]],
    });
  });
});

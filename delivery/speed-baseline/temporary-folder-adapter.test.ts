import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../src/application/ports/file-system/directory-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { createTemporaryDirectoryOutside } from "../../src/infrastructure/node/file-system/temporary-directory-port.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createTemporaryFolderPort } from "./temporary-folder-adapter.ts";

describe("createTemporaryFolderPort write", () => {
  it("makes the sample's temporary folder inside its copy", () => {
    const create = vi
      .fn<DirectoryPort["create"]>()
      .mockReturnValue({ outcome: "ok", value: undefined });
    const temporaryFolders = createTemporaryFolderPort({
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      directories: { create },
      allocateOutside: vi.fn<typeof createTemporaryDirectoryOutside>(),
    });

    const folder = temporaryFolders.write({ place: "sample", copy: absoluteRootOf("/work/copy") });

    expect({ folder, created: create.mock.calls }).toEqual({
      folder: { outcome: "ok", value: "/work/copy/.hone-speed-temporary" },
      created: [[{ path: "/work/copy/.hone-speed-temporary" }]],
    });
  });

  it("allocates a target index folder outside the repository and keeps the host failure", () => {
    const allocateOutside = vi.fn<typeof createTemporaryDirectoryOutside>().mockReturnValue({
      outcome: "failed",
      error: { detail: "system temporary path is unavailable" },
    });
    const create = vi.fn<DirectoryPort["create"]>();
    const temporaryFolders = createTemporaryFolderPort({
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      directories: { create },
      allocateOutside,
    });

    const folder = temporaryFolders.write({
      place: "target-index",
      outside: absoluteRootOf("/work/repo"),
    });

    expect({ folder, requested: allocateOutside.mock.calls, created: create.mock.calls }).toEqual({
      folder: {
        outcome: "failed",
        error: {
          kind: "target-index-directory-uncreatable",
          detail: "system temporary path is unavailable",
        },
      },
      requested: [[{ outside: "/work/repo" }]],
      created: [],
    });
  });
});

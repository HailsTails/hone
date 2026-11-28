import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../src/application/ports/file-system/directory-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
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
    });

    const folder = temporaryFolders.write({ copy: absoluteRootOf("/work/copy") });

    expect({ folder, created: create.mock.calls }).toEqual({
      folder: { outcome: "ok", value: "/work/copy/.hone-speed-temporary" },
      created: [[{ path: "/work/copy/.hone-speed-temporary" }]],
    });
  });
});

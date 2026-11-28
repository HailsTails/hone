import type { DirectoryPort } from "../../src/application/ports/file-system/directory-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import type { createTemporaryDirectoryOutside } from "../../src/infrastructure/node/file-system/temporary-directory-port.ts";
import type { TemporaryFolderPort } from "./temporary-folder-port.ts";

const TEMPORARY_FOLDER = ".hone-speed-temporary";

export const createTemporaryFolderPort = (options: {
  readonly path: PathPort;
  readonly directories: Pick<DirectoryPort, "create">;
  readonly allocateOutside: typeof createTemporaryDirectoryOutside;
}): TemporaryFolderPort => ({
  write: (request) => {
    if (request.place === "target-index") {
      const folder = options.allocateOutside({ outside: request.outside });
      return folder.outcome === "failed"
        ? {
            outcome: "failed",
            error: { kind: "target-index-directory-uncreatable", detail: folder.error.detail },
          }
        : folder;
    }
    const location = options.path.join({ segments: [request.copy, TEMPORARY_FOLDER] });
    const folder = options.path.resolve({ path: location });
    if (folder.outcome === "failed") {
      return { outcome: "failed", error: { kind: "temporary-folder-unresolved", path: location } };
    }
    const created = options.directories.create({ path: folder.value });
    return created.outcome === "failed"
      ? {
          outcome: "failed",
          error: { kind: "temporary-folder-unwritten", detail: created.error.detail },
        }
      : folder;
  },
});

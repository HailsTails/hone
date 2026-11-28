import type { DirectoryTreePort } from "../../src/application/ports/file-system/directory-tree-port.ts";
import type { DirectoryRemovalPort } from "./directory-removal-port.ts";

export const createDirectoryRemovalPort = (options: {
  readonly tree: Pick<DirectoryTreePort, "remove">;
}): DirectoryRemovalPort => ({
  remove: (request) => {
    const removed = options.tree.remove({ path: request.directory });
    return removed.outcome === "failed"
      ? {
          outcome: "failed",
          error: {
            kind: "directory-unremoved",
            directory: request.directory,
            detail: removed.error.detail,
          },
        }
      : { outcome: "ok", value: null };
  },
});

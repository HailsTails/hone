import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { DirectoryRemovalPort } from "../../../application/ports/file-system/directory-removal-port.ts";
import { removeEmptyDirectory } from "./file-system-port.ts";

export type DirectoryRemovalSurface = {
  readonly removeEmpty: (request: { readonly path: AbsolutePath }) => void;
};

export const createDirectoryRemovalPort = (options: { readonly surface: DirectoryRemovalSurface }): DirectoryRemovalPort => ({
  removeEmpty: (request) => {
    try {
      options.surface.removeEmpty({ path: request.path });
      return { outcome: "ok", value: undefined };
    } catch (thrown) {
      return { outcome: "failed", error: { kind: "directory-unremovable", path: request.path, detail: failureDetailOf({ thrown }) } };
    }
  },
});

export const createDefaultDirectoryRemovalPort = (_options: Record<string, never>): DirectoryRemovalPort =>
  createDirectoryRemovalPort({ surface: { removeEmpty: removeEmptyDirectory } });

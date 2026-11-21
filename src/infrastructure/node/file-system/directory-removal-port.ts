import type { AbsolutePath } from "../../content-files/absolute-path.ts";
import type { Result } from "../../../domain/result.ts";
import { failureDetailOf } from "./failure-detail.ts";
import { removeEmptyDirectory } from "./file-system-port.ts";

export type DirectoryRemovalFailure = {
  readonly kind: "directory-unremovable";
  readonly path: AbsolutePath;
  readonly detail: string;
};

export type DirectoryRemovalPort = {
  readonly removeEmpty: (request: { readonly path: AbsolutePath }) => Result<void, DirectoryRemovalFailure>;
};

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

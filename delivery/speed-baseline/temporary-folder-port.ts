import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type TemporaryFolderFailure =
  | { readonly kind: "temporary-folder-unwritten"; readonly detail: string }
  | { readonly kind: "temporary-folder-unresolved"; readonly path: string };

export type TemporaryFolderPort = {
  readonly write: (request: {
    readonly copy: AbsolutePath;
  }) => Result<AbsolutePath, TemporaryFolderFailure>;
};

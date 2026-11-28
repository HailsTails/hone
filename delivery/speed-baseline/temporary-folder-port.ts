import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type TemporaryFolderFailure =
  | { readonly kind: "temporary-folder-unwritten"; readonly detail: string }
  | { readonly kind: "temporary-folder-unresolved"; readonly path: string }
  | { readonly kind: "target-index-directory-uncreatable"; readonly detail: string };

export type TemporaryFolderPort = {
  readonly write: (
    request:
      | { readonly place: "sample"; readonly copy: AbsolutePath }
      | { readonly place: "target-index"; readonly outside: AbsolutePath },
  ) => Result<AbsolutePath, TemporaryFolderFailure>;
};

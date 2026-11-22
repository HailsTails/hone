import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type FileCreationFailure =
  | { readonly kind: "already-exists"; readonly path: AbsolutePath }
  | { readonly kind: "uncreatable"; readonly path: AbsolutePath; readonly detail: string };

export type FileCreationPort = {
  readonly createNew: (request: { readonly path: AbsolutePath; readonly text: string }) => Result<void, FileCreationFailure>;
};

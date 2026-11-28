import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type TemporaryDirectoryCreationFailure = {
  readonly kind: "temporary-directory-uncreatable";
  readonly detail: string;
};

export type TemporaryDirectoryPort = {
  readonly write: (request: {
    readonly outside: AbsolutePath;
  }) => Result<AbsolutePath, TemporaryDirectoryCreationFailure>;
};

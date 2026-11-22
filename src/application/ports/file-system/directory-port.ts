import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type DirectoryEntry = {
  readonly name: string;
  readonly kind: "file" | "directory";
};

export type DirectoryFailure = {
  readonly kind: "directory-unreadable";
  readonly path: AbsolutePath;
  readonly detail: string;
};

export type DirectoryCreationFailure = {
  readonly kind: "directory-uncreatable";
  readonly path: AbsolutePath;
  readonly detail: string;
};

export type DirectoryPort = {
  readonly list: (request: {
    readonly path: AbsolutePath;
  }) => Result<readonly DirectoryEntry[], DirectoryFailure>;
  readonly create: (request: {
    readonly path: AbsolutePath;
  }) => Result<void, DirectoryCreationFailure>;
};

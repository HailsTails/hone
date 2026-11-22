import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type DirectoryRemovalFailure = {
  readonly kind: "directory-unremovable";
  readonly path: AbsolutePath;
  readonly detail: string;
};

export type DirectoryRemovalPort = {
  readonly removeEmpty: (request: {
    readonly path: AbsolutePath;
  }) => Result<void, DirectoryRemovalFailure>;
};

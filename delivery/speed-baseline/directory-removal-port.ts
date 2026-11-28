import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type DirectoryRemovalFailure = {
  readonly kind: "directory-unremoved";
  readonly directory: AbsolutePath;
  readonly detail: string;
};

export type DirectoryRemovalPort = {
  readonly remove: (request: {
    readonly directory: AbsolutePath;
  }) => Result<null, DirectoryRemovalFailure>;
};

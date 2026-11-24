import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type LockfilesFailure = { readonly kind: "lockfiles-unread"; readonly detail: string };

export type LockfilesPort = {
  readonly read: (request: {
    readonly directory: AbsolutePath;
  }) => Result<readonly string[], LockfilesFailure>;
};

import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { CommandFailure } from "./command-failure.ts";

export type TargetIndexFailure =
  | { readonly kind: "target-index-unread"; readonly command: CommandFailure }
  | { readonly kind: "target-index-unresolved"; readonly path: string };

export type TargetIndexPort = {
  readonly read: (request: {
    readonly repo: AbsolutePath;
  }) => Result<AbsolutePath, TargetIndexFailure>;
};

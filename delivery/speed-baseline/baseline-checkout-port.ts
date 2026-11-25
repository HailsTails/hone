import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { CommandFailure } from "./command-failure.ts";

export type BaselineCheckoutFailure =
  | { readonly kind: "baseline-unchecked-out"; readonly command: CommandFailure }
  | { readonly kind: "baseline-unresolved"; readonly path: string };

export type BaselineRemovalFailure = {
  readonly kind: "baseline-unremoved";
  readonly directory: AbsolutePath;
  readonly command: CommandFailure;
};

export type BaselineCheckoutPort = {
  readonly read: (request: {
    readonly revision: string;
  }) => Result<AbsolutePath, BaselineCheckoutFailure>;
  readonly write: (request: {
    readonly revision: string;
    readonly directory: AbsolutePath;
  }) => Result<null, BaselineCheckoutFailure>;
  readonly remove: (request: {
    readonly directory: AbsolutePath;
  }) => Result<null, BaselineRemovalFailure>;
};

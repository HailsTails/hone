import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { CommandFailure } from "./command-failure.ts";
import type { SpeedSide } from "./speed-samples.ts";

export type TargetCopyPlace =
  | { readonly kind: "install"; readonly side: SpeedSide }
  | { readonly kind: "sample"; readonly side: SpeedSide; readonly sampleIndex: number };

export type TargetCopyFailure =
  | { readonly kind: "target-uncopied"; readonly command: CommandFailure }
  | { readonly kind: "target-copy-unresolved"; readonly path: string };

export type TargetCopyRemovalFailure = {
  readonly kind: "target-copy-unremoved";
  readonly directory: AbsolutePath;
  readonly command: CommandFailure;
};

export type TargetCopyPort = {
  readonly read: (request: {
    readonly repo: AbsolutePath;
    readonly place: TargetCopyPlace;
  }) => Result<AbsolutePath, TargetCopyFailure>;
  readonly write: (request: {
    readonly repo: AbsolutePath;
    readonly directory: AbsolutePath;
  }) => Result<null, TargetCopyFailure>;
  readonly remove: (request: {
    readonly repo: AbsolutePath;
    readonly directory: AbsolutePath;
  }) => Result<null, TargetCopyRemovalFailure>;
};

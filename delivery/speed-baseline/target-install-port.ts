import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { CommandFailure } from "./command-failure.ts";

export type TargetInstallFailure = {
  readonly kind: "hone-uninstalled";
  readonly command: CommandFailure;
};

export type TargetInstallPort = {
  readonly write: (request: {
    readonly directory: AbsolutePath;
    readonly tarball: AbsolutePath;
  }) => Result<null, TargetInstallFailure>;
};

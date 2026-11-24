import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { CommandFailure } from "./command-failure.ts";

export type HoneDependenciesFailure = {
  readonly kind: "hone-dependencies-uninstalled";
  readonly command: CommandFailure;
};

export type HoneDependenciesPort = {
  readonly write: (request: {
    readonly honeRoot: AbsolutePath;
  }) => Result<null, HoneDependenciesFailure>;
};

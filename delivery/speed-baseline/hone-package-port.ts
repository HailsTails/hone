import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { CommandFailure } from "./command-failure.ts";

export type HonePackageFailure =
  | { readonly kind: "hone-unpacked"; readonly command: CommandFailure }
  | { readonly kind: "tarball-unnamed"; readonly output: string }
  | { readonly kind: "tarball-unresolved"; readonly path: string };

export type HonePackagePort = {
  readonly write: (request: {
    readonly honeRoot: AbsolutePath;
  }) => Result<AbsolutePath, HonePackageFailure>;
};

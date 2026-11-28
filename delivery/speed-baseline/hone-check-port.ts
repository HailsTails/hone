import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type HoneCheckFailure =
  | { readonly kind: "check-exited"; readonly status: number; readonly output: string }
  | { readonly kind: "check-unlaunched"; readonly detail: string }
  | { readonly kind: "cpu-time-missing" };

export type HoneCheckPort = {
  readonly run: (request: {
    readonly command: AbsolutePath;
    readonly repo: AbsolutePath;
    readonly baseRevision: string;
    readonly temporaryFolder: AbsolutePath;
  }) => Result<number, HoneCheckFailure>;
};

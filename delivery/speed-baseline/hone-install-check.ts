import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type HoneInstallFailure = {
  readonly kind: "hone-outside-install";
  readonly resolved: string;
  readonly installResolved: string;
  readonly install: AbsolutePath;
};

export const mapResolvedHoneToInstallCheck = (request: {
  readonly sampleResolved: string;
  readonly installResolved: string;
  readonly install: AbsolutePath;
}): Result<null, HoneInstallFailure> =>
  request.sampleResolved === request.installResolved
    ? { outcome: "ok", value: null }
    : {
        outcome: "failed",
        error: {
          kind: "hone-outside-install",
          resolved: request.sampleResolved,
          installResolved: request.installResolved,
          install: request.install,
        },
      };

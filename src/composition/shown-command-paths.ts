import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { Result } from "../domain/result.ts";
import {
  type PackageLink,
  packageLinkOf,
  UNLINKED,
} from "../infrastructure/command-line/installation/package-link.ts";
import { shownFailureOf } from "../infrastructure/command-line/installation/shown-path.ts";

type ShownPathsRequest = {
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: Result<AbsolutePath, LoadFailure>;
};

const installLinkOf = (request: ShownPathsRequest): PackageLink =>
  request.installRoot.outcome === "failed"
    ? UNLINKED
    : packageLinkOf({ ...request, installRoot: request.installRoot.value });

export const withShownPaths = <Value>(
  request: ShownPathsRequest & { readonly run: Result<Value, LoadFailure> },
): Result<Value, LoadFailure> =>
  request.run.outcome === "failed"
    ? {
        outcome: "failed",
        error: shownFailureOf({
          failure: request.run.error,
          path: request.path,
          repoRoot: request.repoRoot,
          link: installLinkOf(request),
        }),
      }
    : request.run;

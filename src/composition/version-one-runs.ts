import type { RepositoryLocated } from "../application/ports/command/repository-located.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { RunSettingsOf } from "../application/ports/selection/selection-repository.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { Result } from "../domain/result.ts";
import { installRootOf } from "../infrastructure/command-line/installation/install-root.ts";
import {
  type PackageLink,
  packageLinkOf,
  UNLINKED,
} from "../infrastructure/command-line/installation/package-link.ts";
import { shownFailureOf } from "../infrastructure/command-line/installation/shown-path.ts";
import { readRunSettings } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { repoRootOf } from "../infrastructure/printed-report/check-locations.ts";
import { type CommandFailure, loadFailed, loadResultOf } from "./composed-command.ts";

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

export const runSettingsOver =
  (request: { readonly fileText: FileTextPort; readonly path: PathPort }): RunSettingsOf =>
  ({ repoRoot }) =>
    readRunSettings({ fileText: request.fileText, path: request.path, repoRoot });

export const versionOneRunAt = async <Value>(request: {
  readonly ports: { readonly path: PathPort; readonly fileText: FileTextPort };
  readonly moduleUrl: string;
  readonly repo: string;
  readonly run: (located: RepositoryLocated) => Promise<Result<Value, LoadFailure>>;
}): Promise<Result<Value, CommandFailure>> => {
  const { path, fileText } = request.ports;
  const repoRoot = repoRootOf({ path, fileText, repo: request.repo });
  if (repoRoot.outcome === "failed") {
    return loadFailed({ failure: repoRoot.error });
  }
  const installRoot = installRootOf({ path, moduleUrl: request.moduleUrl });
  const run =
    installRoot.outcome === "failed"
      ? installRoot
      : await request.run({ repoRoot: repoRoot.value, installRoot: installRoot.value });
  return loadResultOf({
    result: withShownPaths({ path, fileText, repoRoot: repoRoot.value, installRoot, run }),
  });
};

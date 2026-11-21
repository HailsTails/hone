import type { ProjectionWrite } from "../../domain/runner/runner-result-types.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { parseProjectArguments } from "../../infrastructure/command-line/arguments/command-arguments.ts";
import { projectCommandOutcome } from "../../infrastructure/command-line/outcomes/command-outcome.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import { installRootOf } from "../../infrastructure/command-line/installation/install-root.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { repoRootOf } from "../../infrastructure/printed-report/check-locations.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { withShownPaths } from "../check/run-check-command.ts";
import { runProject } from "../../application/projection/run-project.ts";

const projectionsIn = (
  request: VersionOneCommandRequest & { readonly repoRoot: AbsolutePath; readonly installRoot: Result<AbsolutePath, LoadFailure> },
): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  if (request.installRoot.outcome === "failed") {
    return Promise.resolve(request.installRoot);
  }
  return runProject({
    repoRoot: request.repoRoot,
    installRoot: request.installRoot.value,
    moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
    fileText: request.fileText,
    modules: request.modules,
    engine: request.engine,
    path: request.path,
    git: request.git,
    exceptionRepository: request.exceptionRepositoryOf({ repoRoot: request.repoRoot }),
    exceptionEntryParser: request.exceptionEntryParser,
    selectionRepositoryOf: request.selectionRepositoryOf,
  });
};

const projectResult = (request: VersionOneCommandRequest): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  const parsed = parseProjectArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return Promise.resolve(parsed);
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return Promise.resolve(repoRoot);
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  return projectionsIn({ ...request, repoRoot: repoRoot.value, installRoot }).then((run) =>
    withShownPaths({ path: request.path, fileText: request.fileText, repoRoot: repoRoot.value, installRoot, run }),
  );
};

export const runProjectCommand = (request: VersionOneCommandRequest): Promise<void> =>
  projectResult(request).then((projected) =>
    printOutcome({ process: request.process, outcome: projectCommandOutcome({ result: projected }) }),
  );

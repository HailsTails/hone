import type { RepositoryLocated } from "../../application/ports/command/repository-located.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import { runProject } from "../../application/projection/run-project.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { ProjectionWrite } from "../../domain/runner/runner-result-types.ts";

export type ProjectInput = VersionOneCommandPorts & RepositoryLocated;

export const projectionsIn = (
  request: ProjectInput,
): Promise<Result<readonly ProjectionWrite[], LoadFailure>> =>
  runProject({
    repoRoot: request.repoRoot,
    installRoot: request.installRoot,
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

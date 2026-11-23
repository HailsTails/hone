import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Assessment } from "../../../domain/settings/assessment.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { ModuleExtension } from "../../ports/host/module-extension.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ExceptionEntryParser } from "../../ports/records/exception-entries.ts";
import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import type { SelectionRepository } from "../../ports/selection/selection-repository.ts";

export type VersionOneCheckInput = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly baseRevision: string | undefined;
  readonly assessment: Assessment;
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly git: GitPort;
  readonly selectionRepository: SelectionRepository;
  readonly exceptionRepository: Pick<ExceptionRepository, "read" | "readAt">;
  readonly exceptionEntryParser: ExceptionEntryParser;
};

import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ReportOutput } from "../../../domain/settings/report-output.ts";
import type { RunSettings } from "../../../domain/settings/run-settings.ts";
import type { SelectionReading } from "../../../domain/settings/selection/selection.ts";
import type { ModuleExtension } from "../host/module-extension.ts";

export type SelectionRepository = {
  readonly read: (request: Record<string, never>) => Result<SelectionReading, LoadFailure>;
};

export type SelectionRepositoryOf = (request: {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
}) => SelectionRepository;

export type RunSettingsOf = (request: { readonly repoRoot: AbsolutePath }) => Result<RunSettings<ReportOutput>, LoadFailure>;

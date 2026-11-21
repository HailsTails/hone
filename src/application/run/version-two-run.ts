import type { GovernedRun } from "../../domain/finding/governance.ts";
import type { ProjectedFile } from "../../domain/runner/checks-run-report.ts";
import type { RecordsReading } from "../../domain/records/hone-records/hone-record.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import type { SettingsReading } from "./settings/read-settings.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { TouchedSet } from "../../domain/repository/touched-set.ts";
import { type Assessment, assessmentInEffect } from "../../domain/settings/assessment.ts";
import { type VersionTwoReportOutput, reportOutputInEffect } from "../../domain/settings/report-output.ts";
import type { Result } from "../../domain/result.ts";
import type { ForfeitureAssessment } from "../../domain/settings/assessment.ts";
import type { CheckedTree } from "./checked-tree-of.ts";
import type { EngineRun } from "../ports/engine/engine-run.ts";
import { runReportOf } from "./run-report-of.ts";
import type { TouchedMeasuring } from "./touched-set/touched-set-of.ts";

export type VersionTwoRun = {
  readonly report: RunReport;
  readonly catalogue: SymptomCatalogue;
  readonly touched: TouchedSet;
  readonly output: VersionTwoReportOutput;
  readonly runs: readonly GovernedRun[];
};

export type EngineStageRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly settings: SettingsReading;
  readonly records: RecordsReading;
  readonly tree: CheckedTree;
};

export type VersionTwoStages = {
  readonly catalogue: () => Result<SymptomCatalogue, RunLoadFailure>;
  readonly settings: (request: { readonly catalogue: SymptomCatalogue }) => Result<SettingsReading, RunLoadFailure>;
  readonly records: (request: { readonly catalogue: SymptomCatalogue }) => Result<RecordsReading, RunLoadFailure>;
  readonly tree: (request: { readonly settings: SettingsReading }) => Result<CheckedTree, RunLoadFailure>;
  readonly engines: (request: EngineStageRequest) => Promise<Result<readonly EngineRun[], RunLoadFailure>>;
  readonly projections: (request: EngineStageRequest) => Promise<Result<readonly ProjectedFile[], RunLoadFailure>>;
  readonly touched: (request: { readonly assessment: Assessment; readonly measuring: TouchedMeasuring; readonly records: RecordsReading }) => TouchedSet;
};

export type VersionTwoRequest = {
  readonly forfeiture: ForfeitureAssessment | undefined;
  readonly reportOutput: VersionTwoReportOutput | undefined;
  readonly measuring: TouchedMeasuring;
};

type Inputs = Omit<EngineStageRequest, "tree">;

export const versionTwoInputsOf = (request: { readonly stages: VersionTwoStages }): Result<Inputs, RunLoadFailure> => {
  const catalogue = request.stages.catalogue();
  if (catalogue.outcome === "failed") {
    return catalogue;
  }
  const settings = request.stages.settings({ catalogue: catalogue.value });
  if (settings.outcome === "failed") {
    return settings;
  }
  const records = request.stages.records({ catalogue: catalogue.value });
  return records.outcome === "failed" ? records : { outcome: "ok", value: { catalogue: catalogue.value, settings: settings.value, records: records.value } };
};

export const versionTwoRunOver = async (request: { readonly stages: VersionTwoStages; readonly arguments: VersionTwoRequest }): Promise<Result<VersionTwoRun, RunLoadFailure>> => {
  const inputs = versionTwoInputsOf(request);
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const { catalogue, settings, records } = inputs.value;
  const tree = request.stages.tree({ settings });
  if (tree.outcome === "failed") {
    return tree;
  }
  const runs = await request.stages.engines({ catalogue, settings, records, tree: tree.value });
  if (runs.outcome === "failed") {
    return runs;
  }
  const assessment = assessmentInEffect({ requested: { forfeiture: request.arguments.forfeiture }, configured: settings.runSettings.assessment });
  const touched = request.stages.touched({ assessment, measuring: request.arguments.measuring, records });
  const report = runReportOf({
    catalogue,
    selection: settings.selection.selection,
    excluded: settings.selection.excluded,
    notes: settings.notes,
    records,
    touched,
    runs: runs.value,
    tracked: tree.value.tracked,
  });
  return {
    outcome: "ok",
    value: { report, catalogue, touched, runs: runs.value, output: reportOutputInEffect({ requested: request.arguments.reportOutput, configured: settings.runSettings.reportOutput }) },
  };
};

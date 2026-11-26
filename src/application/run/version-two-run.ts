import type { NamedGovernedRun } from "../../domain/finding/governance.ts";
import { createRuleContent, type RuleContent } from "../../domain/language-layer/rule-content.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { RecordsReading } from "../../domain/records/hone-records/hone-record.ts";
import type { RecordRepointing } from "../../domain/records/hone-records/records-edit.ts";
import { recordsAtMovedPathsOf } from "../../domain/records/hone-records/records-following-renames.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import type { CheckedTree } from "../../domain/repository/checked-tree.ts";
import type { RenamedSinceBase } from "../../domain/repository/renamed-path.ts";
import type { TouchedSet } from "../../domain/repository/touched-set.ts";
import type { Result } from "../../domain/result.ts";
import type { ProjectionEntry } from "../../domain/runner/checks-run-report.ts";
import { type Assessment, assessmentInEffect } from "../../domain/settings/assessment.ts";
import type { ForfeitureAssessment } from "../../domain/settings/assessment.ts";
import {
  type VersionTwoReportOutput,
  reportOutputInEffect,
} from "../../domain/settings/report-output.ts";
import { SETTINGS_FILE_NAME } from "../../domain/settings/settings-file.ts";
import type { EngineCheck, NamedEngineRun } from "../ports/engine/engine-run.ts";
import { readingFollowingRenames } from "../records/read-hone-records.ts";
import { mapChecksToEngineChecks } from "./engines/engine-checks.ts";
import type { NamedEnginesRequest } from "./engines/named-engines-run.ts";
import { namedRunReportOf } from "./run-report-of.ts";
import {
  catalogueWithExternalChecks,
  type NamedSettingsReading,
} from "./settings/read-settings.ts";
import type { TouchedMeasuring } from "./touched-set/touched-set-of.ts";

export type VersionTwoRun = {
  readonly report: RunReport;
  readonly catalogue: SymptomCatalogue;
  readonly content: RuleContent;
  readonly touched: TouchedSet;
  readonly output: VersionTwoReportOutput;
  readonly runs: readonly NamedGovernedRun[];
  readonly moved: readonly RecordRepointing[];
};

export type EngineStageRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly settings: NamedEnginesRequest["settings"];
  readonly records: Pick<RecordsReading, "records">;
  readonly tree: CheckedTree;
  readonly checks: readonly EngineCheck[];
};

export type VersionTwoStages = {
  readonly catalogue: () => Result<SymptomCatalogue, RunLoadFailure>;
  readonly settings: (request: {
    readonly catalogue: SymptomCatalogue;
  }) => Result<NamedSettingsReading, RunLoadFailure>;
  readonly records: (request: {
    readonly catalogue: SymptomCatalogue;
  }) => Result<RecordsReading, RunLoadFailure>;
  readonly tree: (request: {
    readonly settings: NamedSettingsReading;
  }) => Result<CheckedTree, RunLoadFailure>;
  readonly engines: (
    request: EngineStageRequest,
  ) => Promise<Result<readonly NamedEngineRun[], RunLoadFailure>>;
  readonly projections: (
    request: EngineStageRequest,
  ) => Promise<Result<readonly ProjectionEntry[], RunLoadFailure>>;
  readonly renamed: () => RenamedSinceBase;
  readonly touched: (request: {
    readonly assessment: Assessment;
    readonly measuring: TouchedMeasuring;
    readonly records: RecordsReading;
    readonly renamed: RenamedSinceBase;
  }) => TouchedSet;
};

export type VersionTwoRequest = {
  readonly forfeiture: ForfeitureAssessment | undefined;
  readonly reportOutput: VersionTwoReportOutput | undefined;
  readonly measuring: TouchedMeasuring;
  readonly compareDebtAt?: string;
};

type ReadStageInputs = {
  readonly settings: NamedSettingsReading;
  readonly records: RecordsReading;
};

type Inputs = Omit<EngineStageRequest, "tree" | keyof ReadStageInputs> &
  ReadStageInputs & { readonly content: RuleContent };

export const settledCatalogueOf = (request: {
  readonly stages: Pick<VersionTwoStages, "catalogue" | "settings">;
}): Result<Pick<Inputs, "catalogue" | "settings">, RunLoadFailure> => {
  const catalogue = request.stages.catalogue();
  if (catalogue.outcome === "failed") {
    return catalogue;
  }
  const settings = request.stages.settings({ catalogue: catalogue.value });
  return settings.outcome === "failed"
    ? settings
    : {
        outcome: "ok",
        value: {
          catalogue: catalogueWithExternalChecks({
            catalogue: catalogue.value,
            settings: settings.value,
          }),
          settings: settings.value,
        },
      };
};

export const versionTwoInputsOf = (request: {
  readonly stages: VersionTwoStages;
}): Result<Inputs, RunLoadFailure> => {
  const settled = settledCatalogueOf(request);
  if (settled.outcome === "failed") {
    return settled;
  }
  const records = request.stages.records({ catalogue: settled.value.catalogue });
  if (records.outcome === "failed") {
    return records;
  }
  const content = createRuleContent({ catalogues: [settled.value.catalogue] });
  const checks = mapChecksToEngineChecks({ checks: settled.value.catalogue.checks, content });
  return checks.outcome === "failed"
    ? checks
    : {
        outcome: "ok",
        value: { ...settled.value, records: records.value, content, checks: checks.value },
      };
};

export type MeasuredEngines = Omit<EngineStageRequest, keyof ReadStageInputs> &
  ReadStageInputs & {
    readonly content: RuleContent;
    readonly runs: readonly NamedEngineRun[];
  };

export const measureEngines = async (request: {
  readonly stages: VersionTwoStages;
}): Promise<Result<MeasuredEngines, RunLoadFailure>> => {
  const inputs = versionTwoInputsOf(request);
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const tree = request.stages.tree({ settings: inputs.value.settings });
  if (tree.outcome === "failed") {
    return tree;
  }
  const { content, ...stageInputs } = inputs.value;
  const measuring = { ...stageInputs, tree: tree.value };
  const runs = await request.stages.engines(measuring);
  return runs.outcome === "failed"
    ? runs
    : { outcome: "ok", value: { ...measuring, content, runs: runs.value } };
};

type RecordsAfterRenames = {
  readonly moved: readonly RecordRepointing[];
  readonly followed: RecordsReading;
  readonly touched: TouchedSet;
};

const createRecordsAfterRenames = (request: {
  readonly stages: Pick<VersionTwoStages, "renamed" | "touched">;
  readonly arguments: VersionTwoRequest;
  readonly settings: NamedSettingsReading;
  readonly records: RecordsReading;
}): RecordsAfterRenames => {
  const { records } = request;
  const renamed = request.stages.renamed();
  const moved =
    renamed.measured === "yes" && records.base.measured === "yes"
      ? recordsAtMovedPathsOf({
          records: records.records,
          renamed: renamed.renamed,
          held: records.base.held,
        })
      : [];
  const followed = readingFollowingRenames({ reading: records, renamed, moved });
  const touched = request.stages.touched({
    assessment: assessmentInEffect({
      requested: { forfeiture: request.arguments.forfeiture },
      configured: request.settings.runSettings.assessment,
    }),
    measuring: request.arguments.measuring,
    records: followed,
    renamed,
  });
  return { moved, followed, touched };
};

export const versionTwoRunOver = async (request: {
  readonly stages: VersionTwoStages;
  readonly arguments: VersionTwoRequest;
}): Promise<Result<VersionTwoRun, RunLoadFailure>> => {
  const measured = await measureEngines(request);
  if (measured.outcome === "failed") {
    return measured;
  }
  const { catalogue, settings, records, content, tree, runs } = measured.value;
  const { moved, followed, touched } = createRecordsAfterRenames({ ...request, settings, records });
  const report = namedRunReportOf({
    catalogue,
    content,
    selection: settings.selection,
    excluded: settings.selection.excluded,
    notes: settings.notes,
    records: followed,
    touched,
    runs,
    tracked: tree.tracked,
    available: settings.available,
    ...(request.arguments.compareDebtAt === undefined
      ? {}
      : {
          compareDebt: {
            revision: request.arguments.compareDebtAt,
            settings:
              touched.measured === "yes" &&
              [...touched.paths].some((file) => file === SETTINGS_FILE_NAME)
                ? "changed"
                : "unchanged",
            checks: settings.selection.selected.some(
              ({ binding }) => typeof binding.ruleSet === "object",
            )
              ? "external"
              : "shipped",
          },
        }),
  });
  if (report.outcome === "failed") {
    return report;
  }
  return {
    outcome: "ok",
    value: {
      report: report.value,
      catalogue,
      content,
      touched,
      runs,
      moved,
      output: reportOutputInEffect({
        requested: request.arguments.reportOutput,
        configured: settings.runSettings.reportOutput,
      }),
    },
  };
};

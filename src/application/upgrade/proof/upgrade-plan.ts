import {
  type ClauseChecks,
  createClauseChecks,
} from "../../../domain/language-layer/clause-checks.ts";
import { createRuleContent } from "../../../domain/language-layer/rule-content.ts";
import { recordsTextOf } from "../../../domain/records/hone-records/records-edit.ts";
import {
  type AuthorisationContent,
  mappedRecords,
  type RecordLine,
  type MappedRecords,
  type MappedRecordsDocument,
  type RecordInput,
} from "../../../domain/records/upgrade/records-mapping.ts";
import {
  mapSelectionToVersionTwo,
  readConfinedPackages,
} from "../../../domain/records/upgrade/selection-mapping.ts";
import type { UpgradeRefusal } from "../../../domain/records/upgrade/upgrade-refusal.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../domain/result.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type { ProjectionEntry } from "../../../domain/runner/checks-run-report.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import { SETTINGS_FILE_NAME } from "../../../domain/settings/settings-file.ts";
import type {
  SettingsFileFormat,
  VersionTwoSettingsFile,
} from "../../ports/settings/settings-file-format.ts";
import type { PlanRefusal, ProjectionFailure } from "../../ports/upgrade/plan-refusal.ts";
import type { RecordAnswered } from "../../ports/upgrade/record-answer-oracle.ts";
import type { VersionOneReading } from "../../ports/upgrade/version-one-reading.ts";
import { reachBeyondEntriesOf } from "../mapping/written-reach.ts";
import { recordInputsOf } from "../record-answers/record-inputs.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";

const SETTINGS_FILE = repoPathOf(SETTINGS_FILE_NAME);

export type PlannedProjection = {
  readonly entries: readonly ProjectionEntry[];
  readonly projections: readonly PlannedRepoFile[];
};

export type ProjectionFilesOf = (request: {
  readonly settings: VersionTwoSettingsFile;
  readonly documents: readonly MappedRecordsDocument[];
}) => Promise<Result<PlannedProjection, ProjectionFailure>>;

export type UpgradePlan = {
  readonly inputs: readonly RecordInput[];
  readonly lines: readonly RecordLine[];
  readonly files: readonly PlannedRepoFile[];
  readonly projected: readonly PlannedRepoFile[];
  readonly projectionEntries: readonly ProjectionEntry[];
};

export type UpgradePlanRequest = {
  readonly reading: VersionOneReading;
  readonly answered: readonly RecordAnswered[];
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly projectionFilesOf: ProjectionFilesOf;
  readonly settingsFormat: Pick<SettingsFileFormat, "textOf">;
};

type MappedVersionTwo = {
  readonly settings: VersionTwoSettingsFile;
  readonly records: MappedRecords;
};

const mapInputsToVersionTwo = (request: {
  readonly selection: ConsumerSelectionFile;
  readonly clauseChecks: ClauseChecks;
  readonly content: AuthorisationContent;
  readonly inputs: readonly RecordInput[];
}): Result<MappedVersionTwo, PlanRefusal> => {
  const selection = mapSelectionToVersionTwo({
    selection: request.selection,
    clauseChecks: request.clauseChecks,
  });
  const confined = readConfinedPackages({ selection: request.selection });
  const records = mappedRecords({
    inputs: request.inputs,
    clauseChecks: request.clauseChecks,
    content: request.content,
    confinedOutsideDependencies: confined.packages,
  });
  const refusals: readonly UpgradeRefusal[] = [
    ...(selection.outcome === "failed" ? selection.error : []),
    ...(confined.confined === "unreadable"
      ? confined.clauses.map((clause): UpgradeRefusal => ({
          kind: "confined-packages-unreadable",
          clause: clauseAddressText({ address: clause }),
        }))
      : []),
    ...(records.outcome === "failed" ? records.error : []),
  ];
  return selection.outcome === "ok" && records.outcome === "ok" && refusals.length === 0
    ? {
        outcome: "ok",
        value: {
          settings: { ...selection.value, eslintProjectionKind: "mjs" },
          records: records.value,
        },
      }
    : { outcome: "failed", error: { kind: "mapping-refused", refusals } };
};

const recordFilesOf = (request: {
  readonly documents: readonly MappedRecordsDocument[];
}): readonly PlannedRepoFile[] =>
  request.documents.map(({ file, version, records }) => ({
    file,
    text: recordsTextOf({ document: { version, records } }),
  }));

export const upgradePlanOf = async (
  request: UpgradePlanRequest,
): Promise<Result<UpgradePlan, PlanRefusal>> => {
  const inputs = recordInputsOf({ heads: request.reading.heads, answered: request.answered });
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const mapped = mapInputsToVersionTwo({
    selection: request.reading.selection,
    clauseChecks: createClauseChecks({ catalogues: request.catalogues }),
    content: createRuleContent({
      catalogues: request.catalogues.map(({ catalogue }) => catalogue),
    }),
    inputs: inputs.value,
  });
  if (mapped.outcome === "failed") {
    return mapped;
  }
  const { settings, records } = mapped.value;
  const { documents, lines } = records;
  const beyond = reachBeyondEntriesOf({
    written: documents.flatMap(({ records: written }) => written),
    inputs: inputs.value,
    catalogues: request.catalogues,
  });
  if (beyond.length > 0) {
    return { outcome: "failed", error: { kind: "reach-beyond-entries", records: beyond } };
  }
  const projected = await request.projectionFilesOf({ settings, documents });
  if (projected.outcome === "failed") {
    return projected;
  }
  return {
    outcome: "ok",
    value: {
      inputs: inputs.value,
      lines,
      files: [
        {
          file: SETTINGS_FILE,
          text: request.settingsFormat.textOf({ settings }),
        },
        ...recordFilesOf({ documents }),
      ],
      projected: projected.value.projections,
      projectionEntries: projected.value.entries,
    },
  };
};

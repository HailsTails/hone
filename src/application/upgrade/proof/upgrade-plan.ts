import { recordsTextOf } from "../../../domain/records/hone-records/records-edit.ts";
import {
  mappedRecords,
  type MappedRecordsDocument,
  type RecordInput,
} from "../../../domain/records/upgrade/records-mapping.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { SETTINGS_FILE_NAME } from "../../../domain/settings/settings-file.ts";
import type { SettingsFile } from "../../../domain/settings/settings-file.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";
import type { PlanRefusal, ProjectionFailure } from "../../ports/upgrade/plan-refusal.ts";
import type { RecordAnswered } from "../../ports/upgrade/record-answer-oracle.ts";
import type { VersionOneReading } from "../../ports/upgrade/version-one-reading.ts";
import { mappedSettings } from "../mapping/settings-mapping.ts";
import { reachBeyondEntriesOf } from "../proof-comparison/written-reach.ts";
import { recordInputsOf } from "../record-answers/record-inputs.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";

const SETTINGS_FILE = repoPathOf(SETTINGS_FILE_NAME);

export type PlannedProjection = {
  readonly files: readonly PlannedRepoFile[];
  readonly projections: readonly PlannedRepoFile[];
};

export type ProjectionFilesOf = (request: {
  readonly settings: SettingsFile;
  readonly documents: readonly MappedRecordsDocument[];
}) => Promise<Result<PlannedProjection, ProjectionFailure>>;

export type UpgradePlan = {
  readonly inputs: readonly RecordInput[];
  readonly files: readonly PlannedRepoFile[];
  readonly projected: readonly PlannedRepoFile[];
};

export type UpgradePlanRequest = {
  readonly reading: VersionOneReading;
  readonly answered: readonly RecordAnswered[];
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly projectionFilesOf: ProjectionFilesOf;
  readonly settingsFormat: Pick<SettingsFileFormat, "textOf">;
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
  const settings = mappedSettings({
    selection: request.reading.selection,
    catalogues: request.catalogues,
  });
  const records = mappedRecords({ inputs: inputs.value, catalogues: request.catalogues });
  if (settings.outcome === "failed" || records.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "mapping-refused",
        refusals: [
          ...(settings.outcome === "failed" ? settings.error : []),
          ...(records.outcome === "failed" ? records.error : []),
        ],
      },
    };
  }
  const { documents } = records.value;
  const beyond = reachBeyondEntriesOf({
    written: documents.flatMap(({ records: written }) => written),
    inputs: inputs.value,
    catalogues: request.catalogues,
  });
  if (beyond.length > 0) {
    return { outcome: "failed", error: { kind: "reach-beyond-entries", records: beyond } };
  }
  const projected = await request.projectionFilesOf({
    settings: settings.value.settings,
    documents,
  });
  if (projected.outcome === "failed") {
    return projected;
  }
  return {
    outcome: "ok",
    value: {
      inputs: inputs.value,
      files: [
        {
          file: SETTINGS_FILE,
          text: request.settingsFormat.textOf({ settings: settings.value.settings }),
        },
        ...recordFilesOf({ documents }),
        ...projected.value.files,
      ],
      projected: projected.value.projections,
    },
  };
};

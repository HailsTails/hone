import { createClauseChecks } from "../../../domain/language-layer/clause-checks.ts";
import { mappedSettings } from "../../../domain/records/upgrade/settings-mapping.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { NamedEngineRun } from "../../ports/engine/engine-run.ts";
import type { LoadFailureDetail } from "../../ports/report/load-failure-detail.ts";
import type {
  EngineFindings,
  EnginePass,
  EnginePassFailure,
} from "../../ports/upgrade/engine-pass.ts";
import type {
  CheckedVersionOneProjection,
  MeasureVersionOneProjection,
  ProjectionMeasurement,
} from "../../ports/upgrade/version-one-measurement.ts";
import { mapCataloguesToEngineChecks } from "../../run/engines/engine-checks.ts";
import type { NamedEnginesRequest } from "../../run/engines/named-engines-run.ts";
import { callNamedEngines } from "../../run/engines/named-engines-run.ts";
import { type NamedSettingsReading, bindNamedSettings } from "../../run/settings/read-settings.ts";
import {
  versionOneAnsweredFilesOf,
  versionOneNamesOf,
  versionOneObservationsOf,
} from "./version-one-observations.ts";

export type NamedVersionOnePassRequest = Omit<
  NamedEnginesRequest,
  "settings" | "checks" | "answered" | "engine"
> &
  Pick<Parameters<typeof bindNamedSettings>[0], "sources" | "readPiece"> & {
    readonly selected: Parameters<typeof versionOneNamesOf>[0]["selected"];
    readonly selection: Parameters<typeof mappedSettings>[0]["selection"];
    readonly catalogues: readonly RuleSetCatalogue[];
    readonly settingsPath: string;
    readonly loadFailureDetail: LoadFailureDetail;
    readonly measureVersionOne: MeasureVersionOneProjection;
    readonly checkProjection: (
      request: Parameters<EnginePass["findingsFor"]>[0],
    ) => Promise<Result<CheckedVersionOneProjection | undefined, EnginePassFailure>>;
  };

const refused = (detail: string): Result<never, EnginePassFailure> => ({
  outcome: "failed",
  error: { kind: "version-one-run-failed", detail },
});

const settingsFor = (
  request: NamedVersionOnePassRequest,
): Result<Omit<NamedSettingsReading, "eslintProjectionKind">, EnginePassFailure> => {
  const mapped = mappedSettings({
    selection: request.selection,
    clauseChecks: createClauseChecks({ catalogues: request.catalogues }),
  });
  if (mapped.outcome === "failed") {
    return refused(
      `version one selection could not be bound to checks: ${mapped.error.map(({ kind }) => kind).join(", ")}`,
    );
  }
  const settings = bindNamedSettings({
    ...request,
    path: request.settingsPath,
    file: mapped.value.settings,
  });
  return settings.outcome === "failed"
    ? refused(`could not read the version one check bindings: ${settings.error.kind}`)
    : settings;
};

const projectionProblemOf = (request: {
  readonly measurements: readonly ProjectionMeasurement<NamedEngineRun>[];
}): EnginePassFailure | undefined => {
  const unapplied = request.measurements.flatMap(({ unappliedSlices }) => unappliedSlices)[0];
  if (unapplied !== undefined) {
    return { kind: "projection-not-current", file: unapplied, state: "not-applied" };
  }
  const problem = request.measurements
    .map(({ report }) => report)
    .find(
      (
        report,
      ): report is Extract<
        NamedEngineRun,
        { readonly projection: Exclude<NamedEngineRun["projection"], "none" | "current"> }
      > => report.projection !== "none" && report.projection !== "current",
    );
  return problem === undefined
    ? undefined
    : {
        kind: "projection-not-current",
        file: problem.projectionFile,
        state: problem.projection,
      };
};

const findingsFor = async (
  request: NamedVersionOnePassRequest & Parameters<EnginePass["findingsFor"]>[0],
): Promise<Result<EngineFindings, EnginePassFailure>> => {
  const settings = settingsFor(request);
  if (settings.outcome === "failed") return settings;
  const names = versionOneNamesOf(request);
  if (names.outcome === "failed") return names;
  const checkedProjection = await request.checkProjection({ records: request.records });
  if (checkedProjection.outcome === "failed") return checkedProjection;
  const catalogues = request.catalogues.map(({ catalogue }) => catalogue);
  const checks = mapCataloguesToEngineChecks({ catalogues });
  if (checks.outcome === "failed") {
    return refused(request.loadFailureDetail({ failure: checks.error }));
  }
  const ran = await callNamedEngines({
    ...request,
    checks: checks.value,
    settings: settings.value,
    answered: versionOneAnsweredFilesOf({ names: names.value, records: request.records }),
    call: (location, engineRequest) =>
      request.measureVersionOne({
        request: engineRequest,
        projection: checkedProjection.value,
        location,
      }),
  });
  if (ran.outcome === "failed") {
    return refused(request.loadFailureDetail({ failure: ran.error }));
  }
  const problem = projectionProblemOf({
    measurements: ran.value,
  });
  return problem === undefined
    ? versionOneObservationsOf({ names: names.value, runs: ran.value.map(({ report }) => report) })
    : { outcome: "failed", error: problem };
};

export const createNamedVersionOneEnginePass = (
  request: NamedVersionOnePassRequest,
): EnginePass => ({
  findingsFor: ({ records }) => findingsFor({ ...request, records }),
});

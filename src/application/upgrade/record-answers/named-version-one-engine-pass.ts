import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../domain/result.ts";
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
import type { NamedEnginesRequest } from "../../run/engines/named-engines-run.ts";
import { namedEngineCallsOf } from "../../run/engines/named-engines-run.ts";
import {
  checksOfRuleSet,
  type NamedSettingsReading,
  readNamedSettingsFile,
} from "../../run/settings/read-settings.ts";
import { mappedSettings } from "../mapping/settings-mapping.ts";
import {
  versionOneAnsweredFilesOf,
  versionOneNamesOf,
  versionOneObservationsOf,
} from "./version-one-observations.ts";

export type NamedVersionOnePassRequest = Omit<
  NamedEnginesRequest,
  "settings" | "checks" | "answered"
> &
  Pick<Parameters<typeof readNamedSettingsFile>[0], "sources" | "readPiece"> & {
    readonly selected: Parameters<typeof versionOneNamesOf>[0]["selected"];
    readonly selection: Parameters<typeof mappedSettings>[0]["selection"];
    readonly catalogues: Parameters<typeof mappedSettings>[0]["catalogues"];
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
): Result<NamedSettingsReading, EnginePassFailure> => {
  const mapped = mappedSettings({ ...request, notAdoptedClauses: [] });
  if (mapped.outcome === "failed") {
    return refused(
      `version one selection could not be bound to checks: ${mapped.error.map(({ kind }) => kind).join(", ")}`,
    );
  }
  const settings = readNamedSettingsFile({
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
  readonly projection: CheckedVersionOneProjection | undefined;
}): EnginePassFailure | undefined => {
  const unapplied = request.measurements.flatMap(({ unappliedSlices }) => unappliedSlices)[0];
  if (unapplied !== undefined) {
    return { kind: "projection-not-current", file: unapplied, state: "not-applied" };
  }
  const state = request.measurements
    .map(({ report }) => report.projection)
    .find((candidate) => candidate !== "none" && candidate !== "current");
  return state === undefined
    ? undefined
    : {
        kind: "projection-not-current",
        file: request.projection?.projectionFile ?? repoPathOf("disciplines.eslint.mjs"),
        state,
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
  const checks = request.catalogues.flatMap(checksOfRuleSet);
  const ran = await namedEngineCallsOf({
    ...request,
    checks,
    settings: settings.value,
    answered: versionOneAnsweredFilesOf({ names: names.value, records: request.records }),
    call: (call) => {
      const { installRoot, moduleExtension, modules, path } = request;
      return request.measureVersionOne({
        call,
        projection: checkedProjection.value,
        location: { installRoot, moduleExtension, modules, path, mechanism: call.mechanism },
      });
    },
  });
  if (ran.outcome === "failed") {
    return refused(
      ran.error.kind === "not-ready-yet"
        ? ran.error.what.thing
        : request.loadFailureDetail({ failure: ran.error }),
    );
  }
  const problem = projectionProblemOf({
    measurements: ran.value,
    projection: checkedProjection.value,
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

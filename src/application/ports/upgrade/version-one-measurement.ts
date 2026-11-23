import type { CheckAddressText } from "../../../domain/language-layer/check-address-text.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { NamedEngineCall, NamedEngineFailure } from "../engine/engine-port.ts";
import type { NamedEngineRun, NamedEngineRunRequest } from "../engine/engine-run.ts";
import type { RunnerLocation } from "../engine/runner-location.ts";

export type CheckedVersionOneProjection = {
  readonly settingsFile: string;
  readonly projectionFile: RepoPath;
  readonly packageFiles: readonly RepoPath[];
  readonly rules: ReadonlyMap<CheckAddressText, string>;
};

export type VersionOneMeasurementRequest = {
  readonly run: NamedEngineRunRequest;
  readonly projection: CheckedVersionOneProjection;
};

export type ProjectionMeasurement<Report> = {
  readonly report: Report;
  readonly unappliedSlices: readonly RepoPath[];
};

export type MeasureVersionOneProjection = (request: {
  readonly call: NamedEngineCall;
  readonly location: RunnerLocation;
  readonly projection: CheckedVersionOneProjection | undefined;
}) => Promise<Result<ProjectionMeasurement<NamedEngineRun>, NamedEngineFailure>>;

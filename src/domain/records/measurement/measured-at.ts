import type { Check } from "../../language-layer/symptom-catalogue.ts";
import { type Exclusion, exclusionOf } from "../../repository/exclusion.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../rule-set/clause-address.ts";
import type { EngineId } from "../../rule-set/identifier-types.ts";
import type { MeasuredPair } from "../../runner/runner-result-types.ts";
import type { ReachedPlace } from "../answering/record-reach.ts";

export type RunMeasurement = {
  readonly mechanism: EngineId;
  readonly selected: readonly ClauseAddress[];
  readonly measured: readonly MeasuredPair[];
};

export type RunMeasurements = {
  readonly runs: readonly RunMeasurement[];
  readonly tracked: readonly RepoPath[];
  readonly excluded: readonly RepoPath[];
};

export type Measurement = "measured" | "not-measured" | "not-run" | "gone" | "excluded";

type PathsOf = { readonly files: ReadonlySet<string>; readonly folders: ReadonlySet<string> };

type IndexedRun = {
  readonly mechanism: EngineId;
  readonly selected: ReadonlySet<string>;
  readonly measured: ReadonlyMap<string, PathsOf>;
};

export type MeasurementIndex = {
  readonly runs: readonly IndexedRun[];
  readonly tracked: PathsOf;
  readonly excluded: readonly RepoPath[];
};

const FOLDER_SEPARATOR = "/";

const foldersHolding = (request: { readonly file: string }): readonly string[] => {
  const parts = request.file.split(FOLDER_SEPARATOR);
  return [...parts.keys()].slice(1).map((end) => parts.slice(0, end).join(FOLDER_SEPARATOR));
};

const pathsOf = (request: { readonly files: readonly string[] }): PathsOf => ({
  files: new Set(request.files),
  folders: new Set(request.files.flatMap((file) => foldersHolding({ file }))),
});

const clauseKeyOf = (request: { readonly clause: ClauseAddress }): string =>
  clauseAddressText({ address: request.clause });

const indexedRunOf = (request: { readonly run: RunMeasurement }): IndexedRun => ({
  mechanism: request.run.mechanism,
  selected: new Set(request.run.selected.map((clause) => clauseKeyOf({ clause }))),
  measured: new Map(
    [...Map.groupBy(request.run.measured, (pair) => clauseKeyOf({ clause: pair.clause }))].map(
      ([clause, pairs]) => [clause, pathsOf({ files: pairs.map((pair) => pair.file) })],
    ),
  ),
});

export const measurementIndexOf = (request: {
  readonly measurements: RunMeasurements;
}): MeasurementIndex => ({
  runs: request.measurements.runs.map((run) => indexedRunOf({ run })),
  tracked: pathsOf({ files: request.measurements.tracked }),
  excluded: request.measurements.excluded,
});

const runsOfCheck = (request: {
  readonly runs: readonly IndexedRun[];
  readonly check: Check;
}): readonly IndexedRun[] =>
  request.runs.filter(
    (run) =>
      request.check.engines.some((engine) => engine.name === run.mechanism) &&
      run.selected.has(clauseKeyOf({ clause: request.check.clause })),
  );

type Coverage = "covers" | "does-not-cover";

const pathsCover = (request: {
  readonly paths: PathsOf;
  readonly place: ReachedPlace["place"];
}): Coverage => {
  const { paths, place } = request;
  const covered =
    place.at === "file"
      ? paths.files.has(place.file)
      : paths.files.has(place.module) || paths.folders.has(place.module);
  return covered ? "covers" : "does-not-cover";
};

const pathOfPlace = (request: { readonly place: ReachedPlace["place"] }): RepoPath =>
  request.place.at === "file" ? request.place.file : request.place.module;

const placeExclusionOf = (request: {
  readonly excluded: readonly RepoPath[];
  readonly place: ReachedPlace["place"];
}): Exclusion => exclusionOf({ path: pathOfPlace(request), excluded: request.excluded });

const measuredAt = (request: {
  readonly run: IndexedRun;
  readonly reached: ReachedPlace;
}): Coverage => {
  const paths = request.run.measured.get(clauseKeyOf({ clause: request.reached.check.clause }));
  return paths === undefined
    ? "does-not-cover"
    : pathsCover({ paths, place: request.reached.place });
};

export const measurementOf = (request: {
  readonly measurements: MeasurementIndex;
  readonly reached: ReachedPlace;
}): Measurement => {
  const { measurements, reached } = request;
  const running = runsOfCheck({ runs: measurements.runs, check: reached.check });
  if (running.length === 0) {
    return "not-run";
  }
  if (placeExclusionOf({ excluded: measurements.excluded, place: reached.place }) === "excluded") {
    return "excluded";
  }
  if (pathsCover({ paths: measurements.tracked, place: reached.place }) === "does-not-cover") {
    return "gone";
  }
  return running.some((run) => measuredAt({ run, reached }) === "covers")
    ? "measured"
    : "not-measured";
};

import {
  type CheckAddressText,
  checkAddressTextOf,
} from "../../language-layer/check-address-text.ts";
import { type Exclusion, exclusionOf } from "../../repository/exclusion.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { EngineId } from "../../rule-set/identifier-types.ts";
import type { CheckMeasurement } from "../../runner/check-observations.ts";
import type { ReachedPlace } from "../answering/record-reach.ts";

export type RunMeasurement = {
  readonly mechanism: EngineId;
  readonly selected: readonly CheckAddressText[];
  readonly measured: readonly CheckMeasurement[];
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
  readonly selected: ReadonlySet<CheckAddressText>;
  readonly measured: ReadonlyMap<CheckAddressText, PathsOf>;
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

const indexedRunOf = (request: { readonly run: RunMeasurement }): IndexedRun => ({
  mechanism: request.run.mechanism,
  selected: new Set(request.run.selected),
  measured: new Map(
    [...Map.groupBy(request.run.measured, ({ check }) => check)].map(([address, pairs]) => [
      address,
      pathsOf({ files: pairs.map((pair) => pair.file) }),
    ]),
  ),
});

export const measurementIndexOf = (request: {
  readonly measurements: RunMeasurements;
}): MeasurementIndex => ({
  runs: request.measurements.runs.map((run) => indexedRunOf({ run })),
  tracked: pathsOf({ files: request.measurements.tracked }),
  excluded: request.measurements.excluded,
});

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

export const measurementOf = (request: {
  readonly measurements: MeasurementIndex;
  readonly reached: ReachedPlace;
}): Measurement => {
  const { measurements, reached } = request;
  const { check, place } = reached;
  const named = checkAddressTextOf({ check });
  const running = measurements.runs.filter(
    (run) => check.engines.some(({ name }) => name === run.mechanism) && run.selected.has(named),
  );
  if (running.length === 0) {
    return "not-run";
  }
  if (placeExclusionOf({ excluded: measurements.excluded, place: reached.place }) === "excluded") {
    return "excluded";
  }
  if (pathsCover({ paths: measurements.tracked, place: reached.place }) === "does-not-cover") {
    return "gone";
  }
  return running.some((run) => {
    const paths = run.measured.get(named);
    return paths !== undefined && pathsCover({ paths, place }) === "covers";
  })
    ? "measured"
    : "not-measured";
};

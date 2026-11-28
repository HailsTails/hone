import {
  type CheckAddressText,
  checkAddressTextOf,
} from "../../language-layer/check-address-text.ts";
import { exclusionOf } from "../../repository/exclusion.ts";
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

type IndexedRun = {
  readonly mechanism: EngineId;
  readonly selected: ReadonlySet<CheckAddressText>;
  readonly measured: ReadonlyMap<CheckAddressText, ReadonlySet<string>>;
};

export type MeasurementIndex = {
  readonly runs: readonly IndexedRun[];
  readonly tracked: ReadonlySet<string>;
  readonly excluded: readonly RepoPath[];
};

const indexedRunOf = (request: { readonly run: RunMeasurement }): IndexedRun => ({
  mechanism: request.run.mechanism,
  selected: new Set(request.run.selected),
  measured: new Map(
    [...Map.groupBy(request.run.measured, ({ check }) => check)].map(([address, pairs]) => [
      address,
      new Set(pairs.map((pair) => pair.file)),
    ]),
  ),
});

export const measurementIndexOf = (request: {
  readonly measurements: RunMeasurements;
}): MeasurementIndex => ({
  runs: request.measurements.runs.map((run) => indexedRunOf({ run })),
  tracked: new Set(request.measurements.tracked),
  excluded: request.measurements.excluded,
});

export const measurementOf = (request: {
  readonly measurements: MeasurementIndex;
  readonly reached: ReachedPlace;
}): Measurement => {
  const { measurements, reached } = request;
  const { check, file } = reached;
  const named = checkAddressTextOf({ check });
  const running = measurements.runs.filter(
    (run) => check.engines.some(({ name }) => name === run.mechanism) && run.selected.has(named),
  );
  if (running.length === 0) {
    return "not-run";
  }
  if (exclusionOf({ path: file, excluded: measurements.excluded }) === "excluded") {
    return "excluded";
  }
  if (!measurements.tracked.has(file)) {
    return "gone";
  }
  return running.some((run) => run.measured.get(named)?.has(file) === true)
    ? "measured"
    : "not-measured";
};

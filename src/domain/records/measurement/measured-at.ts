import type { MeasuredPair } from "../../runner/runner-result-types.ts";
import type { Check } from "../../language-layer/symptom-catalogue.ts";
import { type ClauseAddress, sameClauseAddress } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { MechanismId } from "../../../infrastructure/hone-config-file/identifiers.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { placeCovers, type ReachedPlace } from "../answering/record-reach.ts";

export type RunMeasurement = {
  readonly mechanism: MechanismId;
  readonly selected: readonly ClauseAddress[];
  readonly measured: readonly MeasuredPair[];
};

export type RunMeasurements = {
  readonly runs: readonly RunMeasurement[];
  readonly tracked: readonly RepoPath[];
  readonly excluded: readonly RepoPath[];
};

export type Measurement = "measured" | "not-measured" | "not-run" | "gone" | "excluded";

const runsOfCheck = (request: { readonly runs: readonly RunMeasurement[]; readonly check: Check }): readonly RunMeasurement[] =>
  request.runs.filter(
    (run) =>
      request.check.engines.some((engine) => engine.mechanism === run.mechanism) &&
      run.selected.some((clause) => sameClauseAddress({ left: clause, right: request.check.clause }) === "same"),
  );

const pairIsAt = (request: { readonly pair: MeasuredPair; readonly reached: ReachedPlace }): "at" | "elsewhere" =>
  sameClauseAddress({ left: request.pair.clause, right: request.reached.check.clause }) === "same" &&
  placeCovers({ place: request.reached.place, file: request.pair.file }) === "holds"
    ? "at"
    : "elsewhere";

const pathOfPlace = (request: { readonly place: ReachedPlace["place"] }): RepoPath => (request.place.at === "file" ? request.place.file : request.place.module);

const placeIsExcluded = (request: { readonly excluded: readonly RepoPath[]; readonly place: ReachedPlace["place"] }): "excluded" | "included" =>
  request.excluded.some((path) => placeCovers({ place: { at: "module", module: path }, file: pathOfPlace(request) }) === "holds") ? "excluded" : "included";

const placeExists = (request: { readonly tracked: readonly RepoPath[]; readonly place: ReachedPlace["place"] }): "exists" | "gone" =>
  request.tracked.some((file) => placeCovers({ place: request.place, file }) === "holds") ? "exists" : "gone";

export const measurementOf = (request: { readonly measurements: RunMeasurements; readonly reached: ReachedPlace }): Measurement => {
  const { measurements, reached } = request;
  const running = runsOfCheck({ runs: measurements.runs, check: reached.check });
  if (running.length === 0) {
    return "not-run";
  }
  if (placeIsExcluded({ excluded: measurements.excluded, place: reached.place }) === "excluded") {
    return "excluded";
  }
  if (placeExists({ tracked: measurements.tracked, place: reached.place }) === "gone") {
    return "gone";
  }
  return running.some((run) => run.measured.some((pair) => pairIsAt({ pair, reached }) === "at")) ? "measured" : "not-measured";
};

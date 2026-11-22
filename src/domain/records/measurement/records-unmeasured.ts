import { baseJudgementOf, type TouchedSet } from "../../repository/touched-set.ts";
import type { BaseRevisionAvailability } from "../../repository/base-revision-availability.ts";
import type { BaseMeasurement, PlacedRecord } from "../hone-records/hone-record.ts";
import { carriedListingOf } from "../hone-records/record-listings.ts";

export type RecordsUnmeasured = { readonly kind: "forfeiture-unmeasured" | "import-unmeasured"; readonly base: BaseRevisionAvailability };

const forfeitureUnmeasured = (request: { readonly records: readonly PlacedRecord[]; readonly touched: TouchedSet }): readonly RecordsUnmeasured[] =>
  request.touched.measured === "no" && request.records.some((placed) => placed.record.kind === "debt")
    ? [{ kind: "forfeiture-unmeasured", base: request.touched.base }]
    : [];

export type CarriedJudgement =
  | { readonly judgement: "nothing-carried" }
  | { readonly judgement: "judged" }
  | { readonly judgement: "unmeasured"; readonly base: BaseRevisionAvailability }
  | { readonly judgement: "left-elsewhere"; readonly carried: number };

export const carriedJudgementOf = (request: {
  readonly records: readonly PlacedRecord[];
  readonly base: BaseMeasurement;
  readonly touched: TouchedSet;
}): CarriedJudgement => {
  const carried = carriedListingOf({ records: request.records }).length;
  if (carried === 0) {
    return { judgement: "nothing-carried" };
  }
  if (request.base.measured === "yes") {
    return { judgement: "judged" };
  }
  const leftToAnotherRun = request.base.base.state === "not-given" && baseJudgementOf(request) === "left-to-another-run";
  return leftToAnotherRun ? { judgement: "left-elsewhere", carried } : { judgement: "unmeasured", base: request.base.base };
};

const importUnmeasured = (request: {
  readonly records: readonly PlacedRecord[];
  readonly base: BaseMeasurement;
  readonly touched: TouchedSet;
}): readonly RecordsUnmeasured[] => {
  const judgement = carriedJudgementOf(request);
  return judgement.judgement === "unmeasured" ? [{ kind: "import-unmeasured", base: judgement.base }] : [];
};

export const recordsUnmeasuredOf = (request: {
  readonly records: readonly PlacedRecord[];
  readonly base: BaseMeasurement;
  readonly touched: TouchedSet;
}): readonly RecordsUnmeasured[] => [...forfeitureUnmeasured(request), ...importUnmeasured(request)];

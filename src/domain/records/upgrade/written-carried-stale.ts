import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { StaleRecord } from "../answering/answering.ts";
import type { HoneRecord, PlacedRecord } from "../hone-records/hone-record.ts";

type Holding = "carried" | "stated" | "not-held";

const mapRecordToHolding = (request: { readonly record: HoneRecord }): Holding => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return record.holding.held;
    case "deviation":
    case "dependency-record":
      return "not-held";
  }
};

export const mapStaleRecordsToWrittenCarried = (request: {
  readonly stale: readonly StaleRecord[];
  readonly written: readonly RepoPath[];
}): readonly PlacedRecord[] =>
  request.stale
    .filter(
      ({ placed }) =>
        request.written.includes(placed.place.file) &&
        mapRecordToHolding({ record: placed.record }) === "carried",
    )
    .map(({ placed }) => placed);

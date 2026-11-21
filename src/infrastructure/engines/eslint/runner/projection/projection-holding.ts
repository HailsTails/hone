import type { ExceptionRecord } from "../../../../discipline-exceptions-folder/exception-records.ts";
import { type ClauseAddress, sameClauseAddress } from "../../../../discipline-exceptions-folder/clause-address.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";

export type ProjectionHolding = "projected-off" | "not-held";

export const projectionHolding = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
}): ProjectionHolding =>
  request.records.some(
    (record) =>
      sameClauseAddress({ left: record.clause, right: request.clause }) === "same" &&
      (record.kind === "clause-wide-carve-out" || record.file === request.file),
  )
    ? "projected-off"
    : "not-held";

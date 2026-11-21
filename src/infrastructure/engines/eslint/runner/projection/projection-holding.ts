import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import { sameClauseAddress } from "../../../../../domain/rule-set/clause-address.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";

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

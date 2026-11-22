import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";

export const reportWithClausesNotAdopted = (request: {
  readonly report: CheckReport;
  readonly clauses: readonly ClauseAddress[];
}): CheckReport => {
  const { report } = request;
  const carried = new Set(request.clauses.map((address) => clauseAddressText({ address })));
  return {
    ...report,
    notAdopted: [...report.notAdopted, ...request.clauses],
    exempted: report.exempted.filter(
      ({ finding }) => !carried.has(clauseAddressText({ address: finding.clause })),
    ),
    stale: report.stale.flatMap((record) =>
      record.kind === "clause-wide-carve-out" ? [] : [record],
    ),
    forfeited: report.forfeited.flatMap((record) =>
      record.kind === "clause-wide-carve-out" ? [] : [record],
    ),
    editions: report.editions.filter(({ address }) => !carried.has(clauseAddressText({ address }))),
  };
};

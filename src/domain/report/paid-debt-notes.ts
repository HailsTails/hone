import { type DebtPair, debtPairKey } from "../records/discipline-exceptions/debt-pair.ts";
import type { GovernanceResult } from "../records/discipline-exceptions/governance.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { MechanismRun } from "../runner/mechanism-run.ts";
import type { PaidDebtNote } from "./check-report.ts";

type GovernedRecords = Pick<GovernanceResult, "stale" | "forfeited">;

const paidMechanismsOf = (request: {
  readonly governed: GovernedRecords;
  readonly paidKeys: ReadonlySet<string>;
}): ReadonlySet<EngineId> =>
  new Set(
    [...request.governed.stale, ...request.governed.forfeited].flatMap((record) =>
      record.kind === "file-carve-out" && request.paidKeys.has(debtPairKey(record))
        ? [record.mechanism]
        : [],
    ),
  );

export const paidDebtNotesOf = (request: {
  readonly governed: GovernedRecords;
  readonly paid: readonly DebtPair[];
  readonly runs: readonly Pick<MechanismRun, "mechanism" | "projection">[];
}): readonly PaidDebtNote[] => {
  if (request.paid.length === 0) {
    return [];
  }
  const paidMechanisms = paidMechanismsOf({
    governed: request.governed,
    paidKeys: new Set(request.paid.map((pair) => debtPairKey(pair))),
  });
  const projections = request.runs.flatMap((run) =>
    run.projection !== "none" && paidMechanisms.has(run.mechanism) ? [run.mechanism] : [],
  );
  return [{ kind: "paid-debt", fileCarveOuts: request.paid.length, projections }];
};

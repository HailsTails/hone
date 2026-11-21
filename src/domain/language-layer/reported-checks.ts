import type { RunnerFailure } from "../runner/runner-failure.ts";
import { type ClauseAddress, clauseAddressText } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { Result } from "../result.ts";
import { checkNamedAt } from "./check-address.ts";
import type { SymptomCatalogue } from "./symptom-catalogue.ts";

type Reported = { readonly clause: ClauseAddress; readonly check?: string };

const unheldCheckFailure = (request: { readonly reported: Reported; readonly address: string }): RunnerFailure => ({
  kind: "runner-invalid-output",
  detail: `the report names the check ${request.address} of ${clauseAddressText({ address: request.reported.clause })}, which that clause does not have`,
});

export const reportedChecksRefusal = (request: {
  readonly catalogue: Pick<SymptomCatalogue, "checks">;
  readonly reported: readonly Reported[];
}): Result<void, RunnerFailure> => {
  const [first] = request.reported.flatMap((reported) => {
    const named = checkNamedAt({ catalogue: request.catalogue, clause: reported.clause, address: reported.check });
    return named.named === "not-of-the-clause" ? [unheldCheckFailure({ reported, address: named.address })] : [];
  });
  return first === undefined ? { outcome: "ok", value: undefined } : { outcome: "failed", error: first };
};

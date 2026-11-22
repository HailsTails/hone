import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import type { Result } from "../../../../../domain/result.ts";
import { checkOfRuleId, type RuledCheck } from "../hone-plugin/check-rule-id.ts";
import type { SelectedCheck } from "./checks-run-types.ts";
import type { ProjectedCheck } from "../projection/checks-projection.ts";

const selectedCheckOf = (request: { readonly checks: readonly RuledCheck[]; readonly projected: ProjectedCheck }): Result<SelectedCheck, RunnerFailure> => {
  const { projected } = request;
  const found = checkOfRuleId({ checks: request.checks, ruleId: projected.ruleId });
  return found.found === "check"
    ? {
        outcome: "ok",
        value: { address: `${projected.symptom}#${projected.check}`, symptom: projected.symptom, ruleId: projected.ruleId, clause: found.check.clause, options: projected.options },
      }
    : { outcome: "failed", error: { kind: "tool-failed", detail: `the rule ${projected.ruleId} names no check of the catalogue that runs on ESLint` } };
};

export const selectedChecksOf = (request: {
  readonly checks: readonly RuledCheck[];
  readonly projected: readonly ProjectedCheck[];
}): Result<readonly SelectedCheck[], RunnerFailure> =>
  gatheredOutcomes({ outcomes: request.projected.map((projected) => listedOutcome({ outcome: selectedCheckOf({ checks: request.checks, projected }) })) });

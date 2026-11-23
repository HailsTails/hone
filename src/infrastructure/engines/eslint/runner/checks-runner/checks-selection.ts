import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import {
  qualifiedAddressOf,
  qualifiedCheckAddressOf,
} from "../../../../../domain/language-layer/check-address.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { checkRuleIdOf, type PluginCheck, runsOnEslint } from "../hone-plugin/check-rule-id.ts";
import type { ProjectedCheck } from "../projection/checks-projection.ts";
import type { SelectedNamedCheck } from "./checks-run-types.ts";

export const selectedNamedChecksOf = (request: {
  readonly checks: readonly PluginCheck[];
  readonly projected: readonly ProjectedCheck[];
}): Result<readonly SelectedNamedCheck[], RunnerFailure> => {
  const checks = new Map(
    request.checks
      .filter((check) => runsOnEslint({ check }) === "eslint")
      .map((check) => [qualifiedCheckAddressOf({ check }), check]),
  );
  return gatheredOutcomes({
    outcomes: request.projected.map(
      (projected): Result<readonly SelectedNamedCheck[], RunnerFailure> => {
        const address: CheckAddressText = `${projected.symptom}#${projected.check}`;
        const check = checks.get(qualifiedAddressOf({ ruleSet: projected.ruleSet, address }));
        return check !== undefined &&
          (projected.plugin !== undefined || checkRuleIdOf({ check }) === projected.ruleId)
          ? {
              outcome: "ok",
              value: [
                {
                  ruleSet: projected.ruleSet,
                  address,
                  symptom: projected.symptom,
                  ruleId: projected.ruleId,
                  options: projected.options,
                },
              ],
            }
          : {
              outcome: "failed",
              error: {
                kind: "tool-failed",
                detail: `the rule ${projected.ruleId} names no check of the catalogue that runs on ESLint`,
              },
            };
      },
    ),
  });
};

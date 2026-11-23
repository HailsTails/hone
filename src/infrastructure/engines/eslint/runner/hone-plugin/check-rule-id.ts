import {
  type AddressedCheck,
  checkAddressTextOf,
} from "../../../../../domain/language-layer/check-address-text.ts";
import type {
  ClauseAddress,
  RuleSetIdentity,
} from "../../../../../domain/rule-set/clause-address-types.ts";
import type { EngineId } from "../../../../../domain/rule-set/identifier-types.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";

export type PluginCheck = AddressedCheck & {
  readonly symptom: {
    readonly name: string;
    readonly title: string;
    readonly ruleSet: RuleSetIdentity;
  };
  readonly engines: readonly { readonly name: EngineId }[];
};

export type RuledCheck = PluginCheck & { readonly clause?: ClauseAddress };

export type CheckOfRuleId<Checked> =
  | { readonly found: "check"; readonly check: Checked }
  | { readonly found: "none" };

export const CHECKS_PLUGIN_NAMESPACE = TOOL_IDENTITY.ownRuleSet;

export const ESLINT_MECHANISM: Extract<EngineId, "eslint"> = "eslint";

const RULE_ID_PREFIX = `${CHECKS_PLUGIN_NAMESPACE}/`;

export const checkRuleNameOf = (request: { readonly check: AddressedCheck }): string =>
  checkAddressTextOf(request);

export const checkRuleIdOf = (request: { readonly check: AddressedCheck }): string =>
  `${RULE_ID_PREFIX}${checkRuleNameOf(request)}`;

export const runsOnEslint = (request: {
  readonly check: Pick<PluginCheck, "engines">;
}): "eslint" | "elsewhere" =>
  request.check.engines.some((engine) => engine.name === ESLINT_MECHANISM) ? "eslint" : "elsewhere";

export const checkOfRuleId = <Checked extends PluginCheck>(request: {
  readonly checks: readonly Checked[];
  readonly ruleId: string;
}): CheckOfRuleId<Checked> => {
  const check = request.checks.find(
    (candidate) =>
      runsOnEslint({ check: candidate }) === "eslint" &&
      checkRuleIdOf({ check: candidate }) === request.ruleId,
  );
  return check === undefined ? { found: "none" } : { found: "check", check };
};

export const eslintRuleIdsOf = (request: {
  readonly checks: readonly PluginCheck[];
}): readonly string[] =>
  request.checks
    .filter((check) => runsOnEslint({ check }) === "eslint")
    .map((check) => checkRuleIdOf({ check }));

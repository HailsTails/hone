import { type AddressedCheck, checkAddressTextOf } from "../../../../../domain/language-layer/check-address-text.ts";
import type { ClauseAddress } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";

export type RuledCheck = {
  readonly name: string;
  readonly symptom: { readonly name: string; readonly title: string };
  readonly clause: ClauseAddress;
  readonly engines: readonly { readonly mechanism: string }[];
};

export type CheckOfRuleId<Checked> = { readonly found: "check"; readonly check: Checked } | { readonly found: "none" };

export const CHECKS_PLUGIN_NAMESPACE = TOOL_IDENTITY.ownRuleSet;

const ESLINT_MECHANISM = "eslint";

const RULE_ID_PREFIX = `${CHECKS_PLUGIN_NAMESPACE}/`;

export const checkRuleNameOf = (request: { readonly check: AddressedCheck }): string => checkAddressTextOf(request);

export const checkRuleIdOf = (request: { readonly check: AddressedCheck }): string => `${RULE_ID_PREFIX}${checkRuleNameOf(request)}`;

export const runsOnEslint = (request: { readonly check: Pick<RuledCheck, "engines"> }): "eslint" | "elsewhere" =>
  request.check.engines.some((engine) => engine.mechanism === ESLINT_MECHANISM) ? "eslint" : "elsewhere";

export const checkOfRuleId = <Checked extends RuledCheck>(request: { readonly checks: readonly Checked[]; readonly ruleId: string }): CheckOfRuleId<Checked> => {
  const check = request.checks.find((candidate) => runsOnEslint({ check: candidate }) === "eslint" && checkRuleIdOf({ check: candidate }) === request.ruleId);
  return check === undefined ? { found: "none" } : { found: "check", check };
};

export const eslintRuleIdsOf = (request: { readonly checks: readonly RuledCheck[] }): readonly string[] =>
  request.checks.filter((check) => runsOnEslint({ check }) === "eslint").map((check) => checkRuleIdOf({ check }));
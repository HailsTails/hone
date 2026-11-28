import type { ClauseAddress, RuleSetIdentity } from "../rule-set/clause-address-types.ts";
import { sameClauseAddress } from "../rule-set/clause-address.ts";
import { ownedNameText } from "../rule-set/rule-set-identity.ts";
import { type CheckAddressText, checkAddressTextOf } from "./check-address-text.ts";
import type { Check, CheckAddress, CheckContent, SymptomCatalogue } from "./symptom-catalogue.ts";

export type FoundCheck =
  | { readonly found: "check"; readonly check: Check }
  | { readonly found: "none" };

const NO_CHECK: FoundCheck = { found: "none" };

const foundAmong = (request: { readonly checks: readonly Check[] }): FoundCheck => {
  const [check] = request.checks;
  return check === undefined ? NO_CHECK : { found: "check", check };
};

export const checkAddressOf = (request: { readonly check: CheckAddress }): CheckAddressText =>
  checkAddressTextOf(request);

export const qualifiedCheckAddressOf = (request: { readonly check: CheckAddress }): string =>
  ownedNameText({ ruleSet: request.check.symptom.ruleSet, name: checkAddressTextOf(request) });

export const qualifiedAddressOf = (request: {
  readonly ruleSet: RuleSetIdentity;
  readonly address: string;
}): string => ownedNameText({ ruleSet: request.ruleSet, name: request.address });

export const checkAt = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly address: string;
}): FoundCheck =>
  foundAmong({
    checks: request.catalogue.checks.filter(
      (candidate) => checkAddressOf({ check: candidate }) === request.address,
    ),
  });

export const checksOf = <Each extends CheckContent>(request: {
  readonly catalogue: { readonly checks: readonly Each[] };
  readonly clause: ClauseAddress;
}): readonly (Each & { readonly clause: ClauseAddress })[] =>
  request.catalogue.checks.filter(
    (check): check is Each & { readonly clause: ClauseAddress } =>
      check.clause !== undefined &&
      sameClauseAddress({ left: check.clause, right: request.clause }) === "same",
  );

export type NamedCheck =
  | { readonly named: "unnamed" }
  | { readonly named: "check"; readonly check: Check }
  | { readonly named: "not-of-the-clause"; readonly address: string };

export const checkNamedAt = (request: {
  readonly catalogue: Pick<SymptomCatalogue, "checks">;
  readonly clause: ClauseAddress;
  readonly address: string | undefined;
}): NamedCheck => {
  const { address } = request;
  if (address === undefined) {
    return { named: "unnamed" };
  }
  const found = foundAmong({
    checks: checksOf(request).filter((check) => checkAddressOf({ check }) === address),
  });
  return found.found === "check"
    ? { named: "check", check: found.check }
    : { named: "not-of-the-clause", address };
};

import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import type { NativeException } from "../../../../../domain/runner/runner-result-types.ts";
import type { RuleState } from "../toolchain/eslint-config-schema.ts";

export type CheckedFile = {
  readonly file: RepoPath;
  readonly states: readonly { readonly ruleId: string; readonly state: RuleState }[];
};

export type ProjectionEffect = "in-effect" | "not-in-effect";

export type Holding = "holds" | "does-not-hold";

export type RuleTarget = {
  readonly ruleId: string;
  readonly clause: ClauseAddress;
  readonly check: string | undefined;
};

const ruleStateIn = (request: {
  readonly checked: CheckedFile;
  readonly ruleId: string;
}): RuleState | undefined =>
  request.checked.states.find((entry) => entry.ruleId === request.ruleId)?.state;

const offIn = (request: {
  readonly checked: CheckedFile;
  readonly ruleId: string;
}): ProjectionEffect => {
  const state = ruleStateIn(request);
  return state?.state === "configured" && state.severity === 0 ? "in-effect" : "not-in-effect";
};

export const enforcedIn = (request: {
  readonly checked: CheckedFile;
  readonly ruleId: string;
}): Holding => {
  const state = ruleStateIn(request);
  return state?.state === "configured" && state.severity === 2 ? "holds" : "does-not-hold";
};

const checkNamed = (request: { readonly target: RuleTarget }): { readonly check?: string } =>
  request.target.check === undefined ? {} : { check: request.target.check };

export const enabledEverywhere = (request: {
  readonly ruleIds: readonly string[];
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect =>
  request.checked.length === 0 ||
  request.ruleIds.every((ruleId) =>
    request.checked.some((checked) => ruleStateIn({ checked, ruleId })?.state === "configured"),
  )
    ? "in-effect"
    : "not-in-effect";

export const allOffIn = (request: {
  readonly checked: CheckedFile;
  readonly ruleIds: readonly string[];
}): ProjectionEffect =>
  request.ruleIds.every((ruleId) => offIn({ checked: request.checked, ruleId }) === "in-effect")
    ? "in-effect"
    : "not-in-effect";

export const ignoreExceptionsOf = (request: {
  readonly targets: readonly RuleTarget[];
  readonly file: RepoPath;
}): readonly NativeException[] =>
  request.targets.map((target): NativeException => ({
    kind: "ignore",
    clause: target.clause,
    file: request.file,
    ...checkNamed({ target }),
  }));

export const overrideExceptionsOf = (request: {
  readonly targets: readonly RuleTarget[];
  readonly checked: CheckedFile;
  readonly holding: (target: RuleTarget) => Holding;
}): readonly NativeException[] =>
  request.targets
    .filter(
      (target) =>
        enforcedIn({ checked: request.checked, ruleId: target.ruleId }) === "does-not-hold",
    )
    .filter((target) => request.holding(target) === "does-not-hold")
    .map((target): NativeException => ({
      kind: "config-override",
      clause: target.clause,
      file: request.checked.file,
      ...checkNamed({ target }),
    }));

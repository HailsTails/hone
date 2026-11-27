import type { AnchorKind } from "../finding/anchor.ts";
import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import { type CheckOptionBinding, resolveCheckOptions } from "../rule-set/check-options.ts";
import type { RuleSetIdentity } from "../rule-set/clause-address-types.ts";
import type { Edition } from "../rule-set/edition-types.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { ReadonlyJsonValue } from "../settings/json-values/json-value.ts";

export type CheckSettingValues = Readonly<Record<string, ReadonlyJsonValue>>;

type CheckBindingFields = {
  readonly address: CheckAddressText;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
  readonly forms?: Readonly<Record<string, CheckAddressText>>;
  readonly checkSettings: CheckSettingValues;
  readonly edition: Edition;
};

export type LintCheckBinding = CheckBindingFields &
  CheckOptionBinding & {
    readonly engine: Exclude<EngineId, "walker">;
  };

export type CheckBinding =
  | LintCheckBinding
  | (CheckBindingFields & { readonly ruleSet: RuleSetIdentity; readonly engine: "walker" });

export const bindCheck = (
  request: CheckBindingFields & {
    readonly ruleSet: RuleSetIdentity;
    readonly engine: EngineId;
  },
): CheckBinding => {
  const { engine, ...fields } = request;
  return engine === "walker"
    ? { ...fields, engine }
    : { ...fields, ...resolveCheckOptions(request), engine };
};

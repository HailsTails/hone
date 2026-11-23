import type { AnchorKind } from "../finding/anchor.ts";
import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import type { Edition } from "../rule-set/edition-types.ts";
import type { EngineId, RuleSetName } from "../rule-set/identifier-types.ts";
import type { ReadonlyJsonValue } from "../settings/json-values/json-value.ts";

export type CheckSettingValues = Readonly<Record<string, ReadonlyJsonValue>>;

export type CheckBinding = {
  readonly address: CheckAddressText;
  readonly ruleSet?: RuleSetName;
  readonly engine: EngineId;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
  readonly forms?: Readonly<Record<string, CheckAddressText>>;
  readonly checkSettings: CheckSettingValues;
  readonly edition: Edition;
};

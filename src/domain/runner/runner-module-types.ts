import type { AnchorKind } from "../finding/anchor.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import type { Edition } from "../rule-set/edition-types.ts";
import type { ReadonlyJsonValue } from "../settings/json-values/json-value.ts";

export type ClauseSettingValues = { readonly [key: string]: ReadonlyJsonValue };

export type RunnerClause = {
  readonly address: ClauseAddress;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
  readonly clauseSettings: ClauseSettingValues;
  readonly edition: Edition;
};

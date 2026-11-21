import type { AnchorKind } from "../../domain/finding/anchor.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import type { Edition } from "../../domain/rule-set/edition-types.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";

export type ClauseSettingValues = { readonly [key: string]: ReadonlyJsonValue };

export type RunnerClause = {
  readonly address: ClauseAddress;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
  readonly clauseSettings: ClauseSettingValues;
  readonly edition: Edition;
};

import type { AnchorKind } from "../finding/anchor.ts";
import type { MechanismId } from "./identifier-types.ts";
import type { ReadonlyJsonValue } from "../settings/json-values/json-value.ts";

export type ClauseExceptions = "allowed" | "refused";

export type AuthoredSourceCase = {
  readonly name: string;
  readonly fileName: string;
  readonly source: string;
  readonly expectedLines: readonly number[];
  readonly edition?: string | undefined;
};

export type AuthoredClauseDefinition =
  | {
      readonly kind: "mechanical";
      readonly id: string;
      readonly summary: string;
      readonly mechanisms: readonly MechanismId[];
      readonly anchor: AnchorKind;
      readonly exceptions?: ClauseExceptions;
      readonly cases: {
        readonly flag: readonly AuthoredSourceCase[];
        readonly allow: readonly AuthoredSourceCase[];
      };
    }
  | {
      readonly kind: "judgement";
      readonly id: string;
      readonly summary: string;
      readonly enforcedBy: "review";
    };

export type AuthoredDisciplineFile = {
  readonly version: 1;
  readonly id: string;
  readonly clauses: readonly AuthoredClauseDefinition[];
};

export type ClauseSettingDeclaration = {
  readonly default: ReadonlyJsonValue;
  readonly choices?: readonly ReadonlyJsonValue[];
};

export type ClauseSettingDeclarations = { readonly [key: string]: ClauseSettingDeclaration };

export type AuthoredPieceFile = {
  readonly version: 1;
  readonly discipline: string;
  readonly mechanism: MechanismId;
  readonly clauses: readonly {
    readonly clause: string;
    readonly settings: unknown;
    readonly clauseSettings?: ClauseSettingDeclarations;
    readonly editions?: readonly string[] | undefined;
  }[];
};
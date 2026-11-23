import type { AnchorKind } from "../finding/anchor.ts";
import type { ReadonlyJsonValue } from "../settings/json-values/json-value.ts";

export type ClauseExceptions = "allowed" | "refused";

export type AuthoredExample = {
  readonly name: string;
  readonly fileName: string;
  readonly source: string;
  readonly expectedLines: readonly number[];
  readonly edition?: string | undefined;
  readonly check?: string | undefined;
};

export type AuthoredExamples = {
  readonly flag: readonly AuthoredExample[];
  readonly allow: readonly AuthoredExample[];
};

export type ClauseSettingDeclaration = {
  readonly default: ReadonlyJsonValue;
  readonly choices?: readonly ReadonlyJsonValue[];
};

export type ClauseSettingDeclarations = { readonly [key: string]: ClauseSettingDeclaration };

export type PieceSettings = { readonly [key: string]: ReadonlyJsonValue };

export type ImplementingCheck = { readonly symptom: string; readonly check: string };

export type AuthoredPieceDeclaration =
  | {
      readonly version: 2;
      readonly exceptions?: ClauseExceptions;
      readonly checkSettings?: ClauseSettingDeclarations;
      readonly anchor: AnchorKind;
      readonly settings: PieceSettings;
      readonly forms?: { readonly [form: string]: ImplementingCheck };
      readonly editions?: readonly string[] | undefined;
    }
  | {
      readonly version: 2;
      readonly exceptions?: ClauseExceptions;
      readonly checkSettings?: ClauseSettingDeclarations;
      readonly anchor?: AnchorKind | undefined;
      readonly settings?: PieceSettings;
      readonly implementation: ImplementingCheck;
      readonly editions?: readonly string[] | undefined;
      readonly examples?: "with-implementation" | undefined;
    };

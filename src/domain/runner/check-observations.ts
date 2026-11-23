import type { Anchor } from "../finding/anchor.ts";
import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { Remedy, ScriptOptionCause } from "./runner-result-types.ts";

export type CheckMeasurement = {
  readonly check: CheckAddressText;
  readonly file: RepoPath;
};

export type CheckHit = CheckMeasurement & {
  readonly anchor: Anchor;
  readonly snippet: string;
  readonly remedy?: Remedy;
  readonly importSpecifier?: string;
};

type CheckInlineDirective = CheckMeasurement & {
  readonly line: number;
  readonly text: string;
};

export type CheckNativeException =
  | (CheckMeasurement & { readonly kind: "ignore" })
  | (CheckMeasurement & { readonly kind: "config-override" })
  | (CheckMeasurement & { readonly kind: "suppression-entry"; readonly location: RepoPath })
  | (CheckInlineDirective & {
      readonly kind: "inline-disable";
      readonly reach: "one-check" | "every-selected-check";
    })
  | (CheckInlineDirective & { readonly kind: "inline-rule-config" })
  | {
      readonly kind: "command-line-option";
      readonly check: CheckAddressText;
      readonly location: RepoPath;
      readonly script: string;
      readonly option: string;
      readonly cause: ScriptOptionCause;
    };

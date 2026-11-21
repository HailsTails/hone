import type { MechanismId } from "../../../domain/rule-set/identifier-types.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";

export type UnansweredCredit = "nothing" | "suppression-only";

export type UpgradeRefusal =
  | { readonly kind: "clause-without-check"; readonly clause: string }
  | { readonly kind: "no-engine-on-mechanism"; readonly check: string; readonly mechanism: MechanismId }
  | {
      readonly kind: "two-engines-on-mechanism";
      readonly check: string;
      readonly mechanism: MechanismId;
      readonly engines: readonly string[];
    }
  | { readonly kind: "record-answers-nothing"; readonly clause: string; readonly file: RepoPath; readonly credited: UnansweredCredit }
  | { readonly kind: "clause-wide-carve-out"; readonly clause: string }
  | { readonly kind: "records-name-refused"; readonly name: string };

export type UpgradeDrop = { readonly kind: "file-exception-why-chains"; readonly value: "optional" };

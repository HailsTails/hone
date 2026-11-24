import type { SymptomUnheld } from "../../language-layer/rule-content.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { EngineId } from "../../rule-set/identifier-types.ts";

export type UnansweredCredit = "nothing" | "suppression-only";

export type UpgradeRefusal =
  | { readonly kind: "clause-without-check"; readonly clause: string }
  | {
      readonly kind: "no-engine-on-mechanism";
      readonly check: string;
      readonly mechanism: EngineId;
    }
  | {
      readonly kind: "two-engines-on-mechanism";
      readonly check: string;
      readonly mechanism: EngineId;
      readonly engines: readonly string[];
    }
  | {
      readonly kind: "record-answers-nothing";
      readonly clause: string;
      readonly file: RepoPath;
      readonly credited: UnansweredCredit;
    }
  | { readonly kind: "records-name-refused"; readonly name: string }
  | { readonly kind: "confined-packages-unreadable"; readonly clause: string }
  | SymptomUnheld;

export type UpgradeDrop = {
  readonly kind: "file-exception-why-chains";
  readonly value: "optional";
};

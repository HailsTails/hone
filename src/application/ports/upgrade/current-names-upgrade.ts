import type { RenamedRecordsFile } from "../../../domain/records/upgrade/records-refiling.ts";
import type { RenamedCheck } from "../settings/settings-file-format.ts";
import type { ProofWriteFailure, Unrestored } from "./proof-outcome.ts";

export type CurrentNamesUpgrade =
  | {
      readonly outcome: "renamed";
      readonly records: readonly RenamedRecordsFile[];
      readonly checks: readonly RenamedCheck[];
    }
  | { readonly outcome: "unwritten"; readonly failure: ProofWriteFailure }
  | {
      readonly outcome: "unrestored";
      readonly failure: ProofWriteFailure;
      readonly unrestored: readonly Unrestored[];
    };

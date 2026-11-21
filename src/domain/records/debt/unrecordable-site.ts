import type { NativeException, ScriptOptionCause } from "../../runner/runner-result-types.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";

export type UnrecordableBecause =
  | { readonly kind: "no-check" }
  | { readonly kind: Exclude<NativeException["kind"], "command-line-option"> }
  | { readonly kind: "command-line-option"; readonly cause: ScriptOptionCause };

export type UnrecordableSite = { readonly address: string; readonly file: RepoPath; readonly because: UnrecordableBecause };

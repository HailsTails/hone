import type { RunnerFailure } from "../../domain/runner/runner-failure.ts";
import type { MechanismId } from "../hone-config-file/identifiers.ts";
import type { RepoPath } from "../hone-records-folder/repo-path.ts";

export type LoadFailure =
  | { readonly kind: "arguments-invalid"; readonly detail: string }
  | { readonly kind: "install-root-unresolvable"; readonly url: string; readonly detail: string }
  | { readonly kind: "file-unreadable"; readonly path: string; readonly detail: string }
  | { readonly kind: "file-malformed"; readonly path: string; readonly detail: string }
  | { readonly kind: "file-unwritable"; readonly path: string; readonly detail: string }
  | { readonly kind: "why-chains-required"; readonly path: string }
  | { readonly kind: "records-in-both-layouts"; readonly path: string; readonly folder: string }
  | { readonly kind: "records-unsplittable"; readonly path: string; readonly detail: string }
  | { readonly kind: "unsupported-version"; readonly path: string; readonly found: unknown }
  | { readonly kind: "reserved-rule-set-name"; readonly name: string }
  | { readonly kind: "rule-set-name-collision"; readonly name: string; readonly other: string }
  | { readonly kind: "duplicate-clause"; readonly address: string; readonly prefixedAddress: string }
  | { readonly kind: "unknown-rule-set"; readonly name: string }
  | { readonly kind: "unknown-discipline"; readonly address: string }
  | { readonly kind: "unknown-clause"; readonly address: string }
  | { readonly kind: "judgement-clause-selected"; readonly address: string }
  | { readonly kind: "judgement-clause-listed"; readonly address: string }
  | { readonly kind: "mechanism-not-allowed"; readonly address: string; readonly mechanism: MechanismId }
  | { readonly kind: "runner-missing"; readonly mechanism: MechanismId }
  | { readonly kind: "runner-invalid"; readonly mechanism: MechanismId; readonly detail: string }
  | { readonly kind: "piece-missing"; readonly address: string; readonly mechanism: MechanismId }
  | { readonly kind: "rule-set-invalid"; readonly path: string; readonly detail: string }
  | { readonly kind: "git-failed"; readonly detail: string }
  | { readonly kind: "config-root-untracked"; readonly root: RepoPath }
  | { readonly kind: "selection-absent"; readonly repo: string }
  | { readonly kind: "unexpected-error"; readonly detail: string }
  | { readonly kind: "runner-failed"; readonly mechanism: MechanismId; readonly failure: RunnerFailure };

type RemovedKind = "why-chains-required" | "records-in-both-layouts" | "records-unsplittable";

export type VersionTwoLoadFailure = Exclude<LoadFailure, { readonly kind: RemovedKind }>;

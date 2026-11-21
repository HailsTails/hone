import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import type { MechanismId } from "../../rule-set/identifier-types.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { RecordedWhyChain } from "./version-one-why-chain.ts";

export type ExistingAuthorisationProvenance = {
  readonly kind: "existing-authorisation";
  readonly source: string;
  readonly decision?: string;
};

export type InheritedDebtProvenance = {
  readonly kind: "inherited-debt";
  readonly source: string;
  readonly decision: string;
};

export type ReasonOnlyEvidence = { readonly whyChain?: never; readonly provenance?: never };

export type AuthorisationEvidence =
  | { readonly whyChain: RecordedWhyChain; readonly provenance?: ExistingAuthorisationProvenance }
  | { readonly whyChain?: never; readonly provenance: ExistingAuthorisationProvenance }
  | ReasonOnlyEvidence;

export type FileDebtEvidence =
  | { readonly whyChain: RecordedWhyChain; readonly provenance?: InheritedDebtProvenance }
  | { readonly whyChain?: never; readonly provenance: InheritedDebtProvenance }
  | ReasonOnlyEvidence;

export type AuthorisedLocationEntry = AuthorisationEvidence & {
  readonly kind: "authorised-location";
  readonly clause: string;
  readonly file: string;
  readonly reason: string;
};

export type FileCarveOutEntry = FileDebtEvidence & {
  readonly kind: "file-carve-out";
  readonly clause: string;
  readonly file: string;
  readonly reason?: string;
};

export type ClauseWideCarveOutEntry = {
  readonly kind: "clause-wide-carve-out";
  readonly clause: string;
  readonly reason: string;
  readonly whyChain: RecordedWhyChain;
};

export type ExceptionEntry = AuthorisedLocationEntry | FileCarveOutEntry | ClauseWideCarveOutEntry;

export type ExceptionsFile = {
  readonly version: 1;
  readonly exceptions: readonly ExceptionEntry[];
};

export type ExceptionRecord =
  | (AuthorisationEvidence & {
      readonly kind: "authorised-location";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly file: RepoPath;
      readonly reason: string;
    })
  | (FileDebtEvidence & {
      readonly kind: "file-carve-out";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly file: RepoPath;
      readonly reason?: string;
    })
  | {
      readonly kind: "clause-wide-carve-out";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly reason: string;
      readonly whyChain: RecordedWhyChain;
    };

export type RecordPlace = {
  readonly layout: "single-file" | "split";
  readonly file: RepoPath;
  readonly index: number;
};

export type InvalidRecord = {
  readonly place: RecordPlace;
  readonly problem:
    | { readonly kind: "clause-unparseable"; readonly detail: string }
    | { readonly kind: "clause-not-selected"; readonly clause: ClauseAddress }
    | { readonly kind: "clause-not-adopted"; readonly clause: ClauseAddress }
    | { readonly kind: "clause-not-run"; readonly clause: ClauseAddress }
    | { readonly kind: "file-not-repo-path"; readonly file: string }
    | { readonly kind: "why-chain-refused"; readonly detail: string }
    | { readonly kind: "evidence-refused"; readonly detail: string }
    | { readonly kind: "import-unverified"; readonly detail: string }
    | { readonly kind: "non-exemptible-clause"; readonly clause: ClauseAddress }
    | { readonly kind: "duplicate"; readonly of: RecordPlace };
};

export type ExceptionReading = {
  readonly records: readonly ExceptionRecord[];
  readonly invalid: readonly InvalidRecord[];
};

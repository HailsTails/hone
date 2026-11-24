import type { Engine } from "../language-layer/symptom-catalogue.ts";
import type { HoneRecordsFailure } from "../records/hone-records-failure.ts";
import type { RecordsDocumentRefusal } from "../records/hone-records/hone-record.ts";
import type { RecordsFolderFailure } from "../records/records-folder-failure.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { RunnerFailure } from "../runner/runner-failure.ts";
import type { CheckChoiceRefusal, CheckSettingsListing } from "../settings/check-choices.ts";
import type { LoadFailure, VersionTwoLoadFailure } from "./load-failure.ts";
import type { MissingProjection, RunProjectionProblem } from "./run-report.ts";
import { mapVersionOneSourceToFailure } from "./version-one-load-failure.ts";

type KeptKind =
  | "arguments-invalid"
  | "install-root-unresolvable"
  | "file-unreadable"
  | "file-malformed"
  | "file-unwritable"
  | "unsupported-version"
  | "reserved-rule-set-name"
  | "rule-set-name-collision"
  | "rule-sets-share-a-check"
  | "unknown-rule-set"
  | "rule-set-invalid"
  | "rule-set-not-upgraded"
  | "rule-set-half-upgraded"
  | "git-failed"
  | "config-root-untracked"
  | "unexpected-error";

export type NotReadyYet = { readonly thing: "command"; readonly command: string };

export type CatalogueUnread =
  | { readonly reason: "absent" }
  | { readonly reason: "unreadable"; readonly detail: string };

export type CatalogueNotRead = {
  readonly kind: "catalogue-not-read";
  readonly path: string;
  readonly reason: CatalogueUnread;
};

export type UpgradeNeeded = { readonly kind: "upgrade-needed"; readonly path: string };

export type SettingsRenameRefusal =
  | {
      readonly kind: "listed-under-both-names";
      readonly path: string;
      readonly under: string;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly kind: "renamed-address-outside-listings";
      readonly path: string;
      readonly listings: readonly string[];
    };

export type RunLoadFailureSource =
  | VersionTwoLoadFailure
  | CheckChoiceRefusal
  | HoneRecordsFailure
  | CatalogueNotRead
  | UpgradeNeeded
  | SettingsRenameRefusal;

export type EngineNaming =
  | { readonly named: "engine"; readonly engine: Engine }
  | { readonly named: "mechanism"; readonly mechanism: EngineId };

export type AllowedEngines =
  | { readonly stated: "by-catalogue"; readonly engines: readonly string[] }
  | { readonly stated: "by-rule-set" };

export type RunLoadFailure =
  | Extract<LoadFailure, { readonly kind: KeptKind }>
  | { readonly kind: "config-absent"; readonly repo: string }
  | { readonly kind: "settings-in-both-versions"; readonly repo: string }
  | { readonly kind: "not-ready-yet"; readonly what: NotReadyYet }
  | { readonly kind: "unknown-check"; readonly check: string }
  | { readonly kind: "review-only-listed"; readonly check: string }
  | {
      readonly kind: "duplicate-check";
      readonly key: "checks" | "checkSettings";
      readonly check: string;
      readonly prefixedCheck: string;
    }
  | {
      readonly kind: "engine-not-allowed";
      readonly check: string;
      readonly engine: string;
      readonly allowed: AllowedEngines;
    }
  | { readonly kind: "engine-missing"; readonly engine: EngineNaming }
  | { readonly kind: "engine-invalid"; readonly engine: EngineNaming; readonly detail: string }
  | {
      readonly kind: "engine-failed";
      readonly engine: EngineNaming;
      readonly failure: RunnerFailure;
    }
  | { readonly kind: "check-missing"; readonly check: string; readonly engine: EngineNaming }
  | {
      readonly kind: "checks-run-together";
      readonly check: string;
      readonly others: readonly string[];
    }
  | {
      readonly kind: "check-settings-refused";
      readonly check: string;
      readonly listing: CheckSettingsListing;
    }
  | { readonly kind: "check-settings-differ"; readonly check: string; readonly other: string }
  | {
      readonly kind: "projection-stale";
      readonly problem: RunProjectionProblem | MissingProjection;
      readonly projectCommand: string;
    }
  | {
      readonly kind: "records-folder-unreadable";
      readonly folder: RepoPath;
      readonly detail: string;
    }
  | { readonly kind: "records-file-unreadable"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "records-file-not-json"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "not-a-records-file"; readonly file: RepoPath }
  | { readonly kind: "not-a-records-name"; readonly folder: RepoPath; readonly name: string }
  | { readonly kind: "records-refused"; readonly refusals: readonly RecordsDocumentRefusal[] }
  | CatalogueNotRead
  | UpgradeNeeded
  | SettingsRenameRefusal;

type EnginesRequest = { readonly engines: readonly Engine[] };

const recordsFolderFailureOf = (request: {
  readonly failure: RecordsFolderFailure;
}): RunLoadFailure => {
  const { failure } = request;
  switch (failure.kind) {
    case "records-folder-unreadable":
    case "records-file-unreadable":
    case "records-file-not-json":
    case "not-a-records-file":
    case "not-a-records-name":
      return failure;
    case "git-failed":
      return { kind: "git-failed", detail: failure.detail };
  }
};

const choiceRefusalOf = (request: { readonly refusal: CheckChoiceRefusal }): RunLoadFailure => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "unknown-check":
    case "review-only-listed":
      return { kind: refusal.kind, check: refusal.address };
    case "engine-not-allowed":
      return {
        kind: refusal.kind,
        check: refusal.address,
        engine: refusal.engine,
        allowed: { stated: "by-catalogue", engines: refusal.engines },
      };
    case "duplicate-check":
      return {
        kind: refusal.kind,
        key: refusal.key,
        check: refusal.address,
        prefixedCheck: refusal.prefixedAddress,
      };
    case "checks-run-together":
      return { kind: refusal.kind, check: refusal.address, others: refusal.others };
    case "check-settings-refused":
      return { kind: refusal.kind, check: refusal.address, listing: refusal.listing };
    case "check-settings-differ":
      return { kind: refusal.kind, check: refusal.address, other: refusal.other };
  }
};

export const runLoadFailureOf = (
  request: EnginesRequest & { readonly source: RunLoadFailureSource },
): RunLoadFailure => {
  const { source, engines } = request;
  switch (source.kind) {
    case "arguments-invalid":
    case "install-root-unresolvable":
    case "file-unreadable":
    case "file-malformed":
    case "file-unwritable":
    case "unsupported-version":
    case "reserved-rule-set-name":
    case "rule-set-name-collision":
    case "rule-sets-share-a-check":
    case "unknown-rule-set":
    case "rule-set-invalid":
    case "rule-set-not-upgraded":
    case "rule-set-half-upgraded":
    case "git-failed":
    case "config-root-untracked":
    case "unexpected-error":
    case "catalogue-not-read":
    case "upgrade-needed":
    case "listed-under-both-names":
    case "renamed-address-outside-listings":
      return source;
    case "selection-absent":
    case "unknown-discipline":
    case "unknown-clause":
    case "judgement-clause-selected":
    case "judgement-clause-listed":
    case "duplicate-clause":
    case "mechanism-not-allowed":
    case "runner-missing":
    case "runner-invalid":
    case "runner-failed":
    case "piece-missing":
      return mapVersionOneSourceToFailure({ engines, source });
    case "unknown-check":
    case "review-only-listed":
    case "engine-not-allowed":
    case "duplicate-check":
    case "checks-run-together":
    case "check-settings-refused":
    case "check-settings-differ":
      return choiceRefusalOf({ refusal: source });
    case "records-folder":
      return recordsFolderFailureOf({ failure: source.failure });
    case "records-documents":
      return { kind: "records-refused", refusals: source.refusals };
  }
};

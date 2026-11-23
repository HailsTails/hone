import type { Engine } from "../language-layer/symptom-catalogue.ts";
import type { HoneRecordsFailure } from "../records/hone-records-failure.ts";
import type { RecordsDocumentRefusal } from "../records/hone-records/hone-record.ts";
import type { RecordsFolderFailure } from "../records/records-folder-failure.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { NotReadyYetFailure } from "../runner/checks-run-report.ts";
import type { RunnerFailure } from "../runner/runner-failure.ts";
import type { CheckChoiceRefusal, CheckSettingsListing } from "../settings/check-choices.ts";
import type { LoadFailure, VersionTwoLoadFailure } from "./load-failure.ts";
import type { MissingProjection, RunProjectionProblem } from "./run-report.ts";

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

export type NotReadyYet =
  | { readonly thing: "command"; readonly command: string }
  | NotReadyYetFailure["what"];

export type CatalogueUnread =
  | { readonly reason: "absent" }
  | { readonly reason: "unreadable"; readonly detail: string };

export type CatalogueNotRead = {
  readonly kind: "catalogue-not-read";
  readonly path: string;
  readonly reason: CatalogueUnread;
};

export type UpgradeNeeded = { readonly kind: "upgrade-needed"; readonly path: string };

export type RunLoadFailureSource =
  | VersionTwoLoadFailure
  | CheckChoiceRefusal
  | HoneRecordsFailure
  | CatalogueNotRead
  | UpgradeNeeded;

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
  | UpgradeNeeded;

type EnginesRequest = { readonly engines: readonly Engine[] };

const engineNamingOf = (
  request: EnginesRequest & { readonly mechanism: EngineId },
): EngineNaming => {
  const engine = request.engines.find((candidate) => candidate.name === request.mechanism);
  return engine === undefined
    ? { named: "mechanism", mechanism: request.mechanism }
    : { named: "engine", engine };
};

const engineNameOf = (request: EnginesRequest & { readonly mechanism: EngineId }): string => {
  const naming = engineNamingOf(request);
  return naming.named === "engine" ? naming.engine.name : naming.mechanism;
};

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
      return source;
    case "selection-absent":
      return { kind: "config-absent", repo: source.repo };
    case "unknown-discipline":
    case "unknown-clause":
      return { kind: "unknown-check", check: source.address };
    case "judgement-clause-selected":
    case "judgement-clause-listed":
      return { kind: "review-only-listed", check: source.address };
    case "duplicate-clause":
      return {
        kind: "duplicate-check",
        key: "checks",
        check: source.address,
        prefixedCheck: source.prefixedAddress,
      };
    case "mechanism-not-allowed":
      return {
        kind: "engine-not-allowed",
        check: source.address,
        engine: engineNameOf({ engines, mechanism: source.mechanism }),
        allowed: { stated: "by-rule-set" },
      };
    case "runner-missing":
      return {
        kind: "engine-missing",
        engine: engineNamingOf({ engines, mechanism: source.mechanism }),
      };
    case "runner-invalid":
      return {
        kind: "engine-invalid",
        engine: engineNamingOf({ engines, mechanism: source.mechanism }),
        detail: source.detail,
      };
    case "runner-failed":
      return {
        kind: "engine-failed",
        engine: engineNamingOf({ engines, mechanism: source.mechanism }),
        failure: source.failure,
      };
    case "piece-missing":
      return {
        kind: "check-missing",
        check: source.address,
        engine: engineNamingOf({ engines, mechanism: source.mechanism }),
      };
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

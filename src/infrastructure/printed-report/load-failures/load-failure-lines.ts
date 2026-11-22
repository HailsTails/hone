import type { RunnerFailure, UnavailablePeer, UnavailablePeers } from "../../../domain/runner/runner-failure.ts";
import { NOT_INSTALLED } from "../../engines/protocol/toolchain/toolchain-requirement.ts";
import type { RecordIssue, RecordsDocumentRefusal } from "../../../domain/records/hone-records/hone-record.ts";
import { NAMED_FOLDER_KINDS, RECORDS_FILE_EXTENSION, RECORDS_FOLDER, SINGLE_FILE_KINDS } from "../../../domain/records/hone-records/records-layout.ts";
import type { CheckSettingsListing } from "../../../domain/settings/check-choices.ts";
import { SETTINGS_FILE_NAME, VERSION_ONE_SETTINGS_FILE_NAME } from "../../../domain/settings/settings-file.ts";
import { TOOL_IDENTITY } from "../../../domain/rule-set/tool-identity.ts";
import { onOneLine, quoted } from "../printed-text.ts";
import { recordsFileText } from "../records/record-lines.ts";
import type { AllowedEngines, CatalogueNotRead, EngineNaming, NotReadyYet, RunLoadFailure } from "../../../domain/report/run-load-failure.ts";

const LOAD_FAILURE_LEAD = "load failure:";

const WHOLE_DOCUMENT = "document";

const ONE_RULE_TODAY = "these checks are one rule today, so they";

const LISTED_TO_RUN = "checkSettings gives settings only to a check listed to run";

const SUPPORTED_VERSION_REPAIR = "add a supported version to the devDependencies of the repository root";

const EACH_SUPPORTED_VERSION_REPAIR = "add a supported version of each to the devDependencies of the repository root";

const RECORDS_FILES = `a records file is ${SINGLE_FILE_KINDS.map((kind) => `${kind}${RECORDS_FILE_EXTENSION}`).join(" or ")}, or a ${RECORDS_FILE_EXTENSION} file named for its symptom, or for its recipe in ${NAMED_FOLDER_KINDS.at(-1)}, inside the folder ${NAMED_FOLDER_KINDS.slice(0, -1).join(", ")} or ${NAMED_FOLDER_KINDS.at(-1)} of ${RECORDS_FOLDER}`;

const engineText = (request: { readonly engine: EngineNaming }): string =>
  request.engine.named === "engine" ? request.engine.engine.name : request.engine.mechanism;

const unavailablePeerRepair = (request: { readonly peer: UnavailablePeer }): string =>
  request.peer.peer === "required" && request.peer.found === NOT_INSTALLED
    ? `${request.peer.packageName} is a required peer of ${TOOL_IDENTITY.packageName}, so this install is incomplete; ${SUPPORTED_VERSION_REPAIR} and reinstall`
    : SUPPORTED_VERSION_REPAIR;

const unavailablePeersRepair = (request: { readonly peers: UnavailablePeers }): string => {
  const [first, ...rest] = request.peers;
  return rest.length === 0 ? unavailablePeerRepair({ peer: first }) : EACH_SUPPORTED_VERSION_REPAIR;
};

const unavailablePeerText = (request: { readonly peer: UnavailablePeer }): string =>
  `${request.peer.packageName} found ${request.peer.found}, supported ${request.peer.supported}`;

const runnerFailureFields = (request: { readonly failure: RunnerFailure }): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "piece-invalid":
      return [failure.kind, failure.pieceRoot, failure.detail];
    case "file-unreadable":
    case "file-unparseable":
      return [failure.kind, failure.file, failure.detail];
    case "toolchain-unavailable":
      return [failure.kind, `${failure.peers.map((peer) => unavailablePeerText({ peer })).join("; ")}: ${unavailablePeersRepair({ peers: failure.peers })}`];
    case "toolchain-shadowed":
      return [
        failure.kind,
        failure.packageName,
        `resolved from ${failure.location} inside the core install ${failure.installRoot}: delete ${failure.installRoot}/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used`,
      ];
    case "tool-failed":
    case "plugin-conflict":
    case "team-config-unloadable":
    case "runner-invalid-output":
      return [failure.kind, failure.detail];
  }
};

const allowedText = (request: { readonly allowed: AllowedEngines }): string =>
  request.allowed.stated === "by-catalogue"
    ? `it runs on ${request.allowed.engines.join(" or ")}; list it with one of those`
    : "the rule set does not run that check on that engine, though its catalogue says it does; list the check with an engine its rule set runs it on, or correct the rule set";

const settingsListingRepair = (request: { readonly listing: CheckSettingsListing }): string =>
  request.listing === "unlisted" ? "list it under checks or remove its settings" : "run it or remove its settings";

const issueText = (request: { readonly issue: RecordIssue }): string => {
  const path = request.issue.path.length === 0 ? WHOLE_DOCUMENT : request.issue.path.join(".");
  return `${path}: ${onOneLine({ text: request.issue.message })}`;
};

const documentRefusalText = (request: { readonly refusal: RecordsDocumentRefusal }): string => {
  const { refusal } = request;
  const lead = `${recordsFileText(refusal)} ${refusal.kind}`;
  switch (refusal.kind) {
    case "not-a-records-file":
      return lead;
    case "document-refused":
      return `${lead} ${refusal.issues.map((issue) => issueText({ issue })).join(", ")}`;
  }
};

const catalogueFields = (request: { readonly failure: CatalogueNotRead }): readonly string[] => {
  const { failure } = request;
  switch (failure.reason.reason) {
    case "absent":
      return [`${failure.path}:`, `the symptom catalogue is missing from this install; reinstall ${TOOL_IDENTITY.packageName}`];
    case "unreadable":
      return [failure.path, failure.reason.detail];
  }
};

const MOST_FOLDERS_NAMED = 3;

const foldersText = (request: { readonly folders: readonly string[] }): string => {
  const unnamed = request.folders.length - MOST_FOLDERS_NAMED;
  const named = request.folders.slice(0, MOST_FOLDERS_NAMED).join(", ");
  return unnamed > 0 ? `${named} and ${unnamed} more` : named;
};

const configRootsFields = (request: { readonly what: Extract<NotReadyYet, { readonly thing: "eslint-config-roots" }> }): readonly string[] => {
  return [
    "eslint-config-roots:",
    `this release does not run a repository that holds other version 2 repositories yet; folders holding ${SETTINGS_FILE_NAME}: ${foldersText({ folders: request.what.paths })}; move them out of this repository, and run each on its own with --repo`,
  ];
};

const notReadyFields = (request: { readonly what: NotReadyYet }): readonly string[] => {
  const { what } = request;
  switch (what.thing) {
    case "command":
      return [`${what.command}:`, `this release runs ${what.command} on version 1 files only, and this repository holds ${SETTINGS_FILE_NAME}`];
    case "eslint-config-roots":
      return configRootsFields({ what });
  }
};

type ToolFailure = Extract<
  RunLoadFailure,
  {
    readonly kind:
      | "arguments-invalid"
      | "git-failed"
      | "unexpected-error"
      | "install-root-unresolvable"
      | "file-unreadable"
      | "file-malformed"
      | "file-unwritable"
      | "rule-set-invalid"
      | "unsupported-version"
      | "reserved-rule-set-name"
      | "unknown-rule-set"
      | "rule-set-name-collision"
      | "config-root-untracked"
      | "config-absent"
      | "settings-in-both-versions"
      | "not-ready-yet";
  }
>;

type CheckFailure = Extract<
  RunLoadFailure,
  {
    readonly kind:
      | "unknown-check"
      | "review-only-listed"
      | "duplicate-check"
      | "engine-not-allowed"
      | "engine-missing"
      | "engine-invalid"
      | "engine-failed"
      | "check-missing"
      | "checks-run-together"
      | "check-settings-refused"
      | "check-settings-differ";
  }
>;

type RecordsFailure = Extract<
  RunLoadFailure,
  {
    readonly kind:
      | "records-folder-unreadable"
      | "records-file-unreadable"
      | "records-file-not-json"
      | "not-a-records-file"
      | "not-a-records-name"
      | "records-refused"
      | "catalogue-not-read"
      | "upgrade-needed";
  }
>;

const CONFIG_ROOT_REPAIR = `an eslintConfigRoots entry is a folder git tracks files under outside every excluded path, spelled exactly as git spells it; fix or remove it in ${SETTINGS_FILE_NAME}`;

const toolFields = (request: { readonly failure: ToolFailure }): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "arguments-invalid":
    case "git-failed":
    case "unexpected-error":
      return [failure.detail];
    case "install-root-unresolvable":
      return [failure.url, failure.detail];
    case "file-unreadable":
    case "file-malformed":
    case "file-unwritable":
    case "rule-set-invalid":
      return [failure.path, failure.detail];
    case "unsupported-version":
      return [failure.path, String(JSON.stringify(failure.found))];
    case "reserved-rule-set-name":
    case "unknown-rule-set":
      return [failure.name];
    case "rule-set-name-collision":
      return [failure.name, failure.other];
    case "config-root-untracked":
      return [`${failure.root}:`, CONFIG_ROOT_REPAIR];
    case "config-absent":
      return [failure.repo, `holds no ${SETTINGS_FILE_NAME}; give the folder that holds it, usually the repository root`];
    case "settings-in-both-versions":
      return [`${failure.repo}:`, `it holds both ${VERSION_ONE_SETTINGS_FILE_NAME} and ${SETTINGS_FILE_NAME}; keep the one this repository runs on and remove the other`];
    case "not-ready-yet":
      return notReadyFields({ what: failure.what });
  }
};

const checkFields = (request: { readonly failure: CheckFailure }): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "unknown-check":
      return [failure.check];
    case "review-only-listed":
      return [`${failure.check}:`, "a check enforced by review has no engine and is left out of checks; remove it"];
    case "duplicate-check":
      return [failure.key, failure.check, failure.prefixedCheck];
    case "engine-not-allowed":
      return [failure.check, `${failure.engine}:`, allowedText(failure)];
    case "engine-missing":
      return [engineText(failure)];
    case "engine-invalid":
      return [engineText(failure), failure.detail];
    case "engine-failed":
      return [engineText(failure), ...runnerFailureFields({ failure: failure.failure })];
    case "check-missing":
      return [failure.check, engineText(failure)];
    case "checks-run-together":
      return [failure.check, `${failure.others.join(" ")}:`, `${ONE_RULE_TODAY} run together; list each of them as ${failure.check} is listed`];
    case "check-settings-refused":
      return [failure.check, `${failure.listing}:`, `${LISTED_TO_RUN}; ${settingsListingRepair(failure)}`];
    case "check-settings-differ":
      return [failure.check, `${failure.other}:`, `${ONE_RULE_TODAY} take one set of settings; give them the same settings`];
  }
};

const recordsFields = (request: { readonly failure: RecordsFailure; readonly upgradeCommand: string | undefined }): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "records-folder-unreadable":
      return [recordsFileText({ file: failure.folder }), failure.detail];
    case "records-file-unreadable":
    case "records-file-not-json":
      return [recordsFileText(failure), failure.detail];
    case "not-a-records-file":
      return [`${recordsFileText(failure)}:`, `${RECORDS_FILES}; move this file to where its kind belongs, or out of ${RECORDS_FOLDER} if it holds no records`];
    case "not-a-records-name":
      return [recordsFileText({ file: failure.folder }), `${quoted({ text: failure.name })}:`, "no repository path can hold that name; rename it"];
    case "records-refused":
      return [failure.refusals.map((refusal) => documentRefusalText({ refusal })).join("; ")];
    case "catalogue-not-read":
      return catalogueFields({ failure });
    case "upgrade-needed":
      return [`${failure.path}:`, `this is a version 1 file; run ${request.upgradeCommand ?? "hone upgrade"}, which rewrites every version 1 file as version 2, and commit what it writes`];
  }
};

const failureFields = (request: { readonly failure: RunLoadFailure; readonly upgradeCommand: string | undefined }): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "arguments-invalid":
    case "git-failed":
    case "unexpected-error":
    case "install-root-unresolvable":
    case "file-unreadable":
    case "file-malformed":
    case "file-unwritable":
    case "rule-set-invalid":
    case "unsupported-version":
    case "reserved-rule-set-name":
    case "unknown-rule-set":
    case "rule-set-name-collision":
    case "config-root-untracked":
    case "config-absent":
    case "settings-in-both-versions":
    case "not-ready-yet":
      return toolFields({ failure });
    case "unknown-check":
    case "review-only-listed":
    case "duplicate-check":
    case "engine-not-allowed":
    case "engine-missing":
    case "engine-invalid":
    case "engine-failed":
    case "check-missing":
    case "checks-run-together":
    case "check-settings-refused":
    case "check-settings-differ":
      return checkFields({ failure });
    case "records-folder-unreadable":
    case "records-file-unreadable":
    case "records-file-not-json":
    case "not-a-records-file":
    case "not-a-records-name":
    case "records-refused":
    case "catalogue-not-read":
    case "upgrade-needed":
      return recordsFields({ failure, upgradeCommand: request.upgradeCommand });
  }
};

export const runLoadFailureLine = (request: { readonly failure: RunLoadFailure; readonly upgradeCommand: string | undefined }): string =>
  [LOAD_FAILURE_LEAD, request.failure.kind, ...failureFields(request).map((text) => onOneLine({ text }))].join(" ");

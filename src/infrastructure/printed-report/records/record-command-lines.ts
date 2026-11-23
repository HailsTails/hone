import type { Authorising } from "../../../application/ports/authorising.ts";
import {
  type DebtEffect,
  type DebtOutcome,
  debtAddressOf,
} from "../../../domain/records/debt/debt-effects.ts";
import { siteAddressText } from "../../../domain/records/debt/debt-sites.ts";
import type { PrunableDebt, PrunedReason } from "../../../domain/records/debt/prunable-debt.ts";
import type { UnrecordableBecause } from "../../../domain/records/debt/unrecordable-site.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { ScriptOptionCause } from "../../../domain/runner/runner-result-types.ts";
import { SETTINGS_FILE_NAME } from "../../../domain/settings/settings-file.ts";
import { NESTED_CONFIGURATION_ISSUE } from "../../command-line/nested-configuration-issue.ts";
import { recordsFileText, refusalText } from "./record-lines.ts";
import { scriptOptionAdviceOf } from "./script-option-advice.ts";

const NO_DETAIL = "";

type RecordableOrigin = Extract<DebtEffect, { readonly effect: "touched" }>["of"];

const TOUCHED_DETAIL: Readonly<Record<RecordableOrigin, string>> = {
  finding:
    "this change created or changed the file, so this run would forfeit debt on it; fix the finding there",
  "native-exception":
    "this change created or changed the file, so this run would forfeit debt on it; fix what the comment hides, then remove the comment",
};

const UNRECORDABLE_DETAIL: Readonly<
  Record<Exclude<UnrecordableBecause["kind"], "command-line-option">, string>
> = {
  "no-check":
    "the catalogue gives this finding no symptom or check to record debt against; fix the finding",
  "no-run": "the engine that reported this finding has no run result to record debt against",
  ignore:
    "an ESLint ignore leaves the file out of the team's lint run, which no record can hold; Hone's run checked the file and recorded what it found there as debt, so what is left is the ignore: remove it, or, if the file is generated or vendored and not yours to hold to the checks, list it in exclude in hone.config.json so Hone's setting and the team's ignore agree",
  "inline-rule-config":
    "a comment that sets a rule's configuration changes what the rule checks, which no record can hold; remove the comment",
  "suppression-entry":
    "an entry in the suppressions file hides a finding from the team's lint run, which no record can hold; Hone's run still finds it and records it as debt, so remove the entry from the suppressions file",
  "config-override":
    "an override in the ESLint configuration turns the check down for this file, which no record can hold; where debt holds the check the projection already turns it off, so remove the override or narrow it to the files that need it",
  "inline-disable":
    "no record of this engine holds this comment; fix the code, or remove the comment",
};

const scriptOptionDetailOf = (request: { readonly cause: ScriptOptionCause }): string => {
  const { problem, fix } = scriptOptionAdviceOf(request);
  return `${request.cause.kind === "weakens-run" ? "a lint-script option " : ""}${problem}; ${fix}`;
};

const unrecordableDetailOf = (request: { readonly because: UnrecordableBecause }): string => {
  const { because } = request;
  return because.kind === "command-line-option"
    ? scriptOptionDetailOf({ cause: because.cause })
    : UNRECORDABLE_DETAIL[because.kind];
};

const detailOf = (request: { readonly outcome: DebtOutcome }): string => {
  const { outcome } = request;
  switch (outcome.effect) {
    case "recorded":
      return NO_DETAIL;
    case "already-recorded":
      return `${recordsFileText({ file: outcome.heldIn })} already holds debt on this symptom and file; the check says why it does not answer`;
    case "left":
      return `under --leave ${outcome.under}; record it as an authorised location with a why chain, or fix it`;
    case "touched":
      return TOUCHED_DETAIL[outcome.of];
    case "nested-configuration":
      return `the file loads the ${outcome.mechanism} configuration in ${outcome.folder}, and ${outcome.selectionFolder} holds its own ${SETTINGS_FILE_NAME}. The parent projection cannot apply debt there (${NESTED_CONFIGURATION_ISSUE}). Fix the finding or govern the folder from this repository`;
    case "unrecordable":
      return unrecordableDetailOf({ because: outcome.because });
  }
};

const withDetail = (request: { readonly head: string; readonly detail: string }): string =>
  request.detail === NO_DETAIL ? request.head : `${request.head}: ${request.detail}`;

export const debtOutcomeLine = (request: { readonly outcome: DebtOutcome }): string =>
  withDetail({
    head: `${siteAddressText({ site: request.outcome })} ${request.outcome.effect} ${request.outcome.file}`,
    detail: detailOf(request),
  });

export const projectNextLine = (request: { readonly projectCommand: string }): string =>
  `run ${request.projectCommand} to put the recorded debt into effect`;

const PRUNED_REASON_TEXT: Readonly<Record<PrunedReason, string>> = {
  paid: "paid",
  forfeited: "forfeited",
  "credited-nothing": "stale",
  "file-gone": "stale, its file is no longer in the repository",
  "file-excluded": "stale, its file is excluded by the settings",
};

export const prunedDebtLine = (request: { readonly pruned: PrunableDebt }): string =>
  `${debtAddressOf({ debt: request.pruned.debt })} removed ${request.pruned.debt.file}: ${PRUNED_REASON_TEXT[request.pruned.reason]}`;

export const authorisingLines = (request: {
  readonly address: string;
  readonly file: RepoPath;
  readonly authorising: Authorising;
}): readonly string[] => {
  const { address, file, authorising } = request;
  switch (authorising.judged) {
    case "accepted":
      return [`${address} authorised ${file}`];
    case "already-held":
      return [
        `${address} already-authorised ${file}: ${recordsFileText({ file: authorising.heldIn })} already holds this record`,
      ];
    case "refused":
      return authorising.refusals.map(
        (refusal) => `${address} refused ${file}: ${refusalText({ refusal })}`,
      );
  }
};

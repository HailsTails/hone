import type {
  PaidDebt,
  StaleReason,
  StaleRecord,
} from "../../../domain/records/answering/answering.ts";
import type { PlacedRecord } from "../../../domain/records/hone-records/hone-record.ts";
import { recordSubjectText, referencesText } from "./record-lines.ts";

export type PruneCommand = { readonly pruneCommand: string };

export const paidLine = (request: PruneCommand & { readonly paid: PaidDebt }): string =>
  `${recordSubjectText(request.paid.debt)}${referencesText({ lead: "answered by", records: request.paid.answeredBy })}; run ${request.pruneCommand} to remove the paid debt`;

const STALE_REASON_TEXT: Readonly<Record<StaleReason, string>> = {
  "credited-nothing": "nothing it holds is found",
  "file-gone": "its file is no longer in the repository",
  "file-excluded": "its file is excluded by the settings, so nothing there was checked",
};

export const staleLine = (request: PruneCommand & { readonly stale: StaleRecord }): string => {
  const { placed, reason } = request.stale;
  const subject = recordSubjectText(placed);
  if (placed.record.kind === "debt") {
    return `${subject}; ${STALE_REASON_TEXT[reason]}: run ${request.pruneCommand} to remove it`;
  }
  return reason === "credited-nothing" ? subject : `${subject}; ${STALE_REASON_TEXT[reason]}`;
};

export const forfeitedLine = (request: PruneCommand & { readonly placed: PlacedRecord }): string =>
  `${recordSubjectText(request.placed)}; this change touched its file, so it no longer answers: fix what it held, then run ${request.pruneCommand} to remove it`;

import { type CommandOutcome, loadFailureOutcome } from "./command-outcome.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { ReportOutput } from "../../../domain/settings/report-output.ts";
import type { Result } from "../../../domain/result.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import { renderGuidedReportText } from "../../printed-report/report-text.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "../../printed-report/symptoms/symptom-notes.ts";
import { verdictOf } from "../../../domain/report/verdict.ts";

export type CheckRun = {
  readonly report: CheckReport;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly pruneCommand: string;
};

export type GuidedCheckRun = CheckRun & { readonly guide: SymptomGuide };

const guidedCheckRunOutcome = (request: { readonly run: GuidedCheckRun }): CommandOutcome => ({
  code: verdictOf({ report: request.run.report }) === "pass" ? 0 : 1,
  text: renderGuidedReportText(request.run),
});

export const guidedCheckCommandOutcome = (request: {
  readonly result: Result<GuidedCheckRun, LoadFailure>;
}): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : guidedCheckRunOutcome({ run: request.result.value });

export const checkCommandOutcome = (request: {
  readonly result: Result<CheckRun, LoadFailure>;
}): CommandOutcome =>
  guidedCheckCommandOutcome({
    result: request.result.outcome === "failed" ? request.result : { outcome: "ok", value: { ...request.result.value, guide: NO_SYMPTOM_GUIDE } },
  });

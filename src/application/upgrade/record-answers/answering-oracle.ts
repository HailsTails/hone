import type { Finding, GovernedRun } from "../../../infrastructure/command-line/governance.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { Result } from "../../../domain/result.ts";
import { applyGovernance } from "../../../domain/records/discipline-exceptions/governance.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { recordAnswersOf } from "./record-answers.ts";
import type { RecordAnswerOracle, OracleFailure } from "./record-answer-oracle.ts";

export type EngineFindings = { readonly findings: readonly Finding[]; readonly runs: readonly GovernedRun[] };

export type EnginePassFailure = Extract<OracleFailure, { readonly kind: "version-one-run-failed" | "projection-not-current" }>;

export type EnginePass = {
  readonly findingsFor: (request: { readonly records: readonly ExceptionRecord[] }) => Promise<Result<EngineFindings, EnginePassFailure>>;
};

export const createAnsweringOracle = (request: {
  readonly enginePass: EnginePass;
  readonly catalogues: readonly RuleSetCatalogue[];
}): RecordAnswerOracle => ({
  answer: async ({ records }) => {
    const pass = await request.enginePass.findingsFor({ records });
    if (pass.outcome === "failed") {
      return pass;
    }
    const governed = applyGovernance({ findings: pass.value.findings, records, touched: { measured: "no", base: { state: "not-given" } }, runs: pass.value.runs });
    return recordAnswersOf({ records, governed, catalogues: request.catalogues });
  },
});

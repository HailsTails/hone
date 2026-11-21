import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { applyGovernance } from "../../../domain/records/discipline-exceptions/governance.ts";
import { recordAnswersOf } from "./record-answers.ts";
import type { RecordAnswerOracle } from "../../ports/upgrade/record-answer-oracle.ts";
import type { EnginePass } from "../../ports/upgrade/engine-pass.ts";

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

import { gatheredOutcomes } from "../../../domain/gathered-outcomes.ts";
import {
  createRuleContent,
  mapAddressToSymptom,
  type RuleContent,
  type SymptomUnheld,
} from "../../../domain/language-layer/rule-content.ts";
import type { Check, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { Result } from "../../../domain/result.ts";
import type { EngineCheck } from "../../ports/engine/engine-run.ts";

export const mapChecksToEngineChecks = (request: {
  readonly checks: readonly Check[];
  readonly content: RuleContent<"title">;
}): Result<readonly EngineCheck[], SymptomUnheld> =>
  gatheredOutcomes({
    outcomes: request.checks.map((check): Result<readonly EngineCheck[], SymptomUnheld> => {
      const symptom = mapAddressToSymptom({ content: request.content, symptom: check.symptom });
      if (symptom.outcome === "failed") return symptom;
      return {
        outcome: "ok",
        value: [
          {
            name: check.name,
            symptom: {
              ruleSet: check.symptom.ruleSet,
              name: check.symptom.name,
              title: symptom.value.title,
            },
            engines: check.engines,
          },
        ],
      };
    }),
  });

export const mapCataloguesToEngineChecks = (request: {
  readonly catalogues: readonly Pick<SymptomCatalogue, "checks" | "symptoms">[];
}): Result<readonly EngineCheck[], SymptomUnheld> =>
  mapChecksToEngineChecks({
    checks: request.catalogues.flatMap((catalogue) => catalogue.checks),
    content: createRuleContent({ catalogues: request.catalogues }),
  });

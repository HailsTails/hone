import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { createSymptomCatalogueRepository, SYMPTOM_CATALOGUE_SEGMENTS } from "./read-symptom-catalogue.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import type { Result } from "../../../domain/result.ts";

export const shippedCataloguesOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
}): Result<readonly RuleSetCatalogue[], LoadFailure> => {
  const holding = createSymptomCatalogueRepository({ fileText: request.fileText, path: request.path, ruleSetRoot: request.installRoot }).read({});
  if (holding.outcome === "failed") {
    return holding;
  }
  return holding.value.held === "catalogue"
    ? { outcome: "ok", value: [{ ruleSet: TOOL_RULE_SET, catalogue: holding.value.catalogue }] }
    : {
        outcome: "failed",
        error: {
          kind: "file-unreadable",
          path: request.path.join({ segments: [request.installRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] }),
          detail: "the install holds no symptom catalogue",
        },
      };
};

import { holdingBoundTo } from "../../domain/language-layer/catalogue-binding.ts";
import { SYMPTOM_CATALOGUE_SEGMENTS } from "../../domain/language-layer/symptom-catalogue-location.ts";
import type { CatalogueHolding } from "../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { EngineBindingsOf } from "../ports/engine-bindings-repository.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { SymptomCatalogueOf } from "../ports/symptom-catalogue-repository.ts";

export type BoundCatalogueRequest = {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly symptomCatalogueOf: SymptomCatalogueOf;
  readonly engineBindingsOf: EngineBindingsOf;
};

export const boundCatalogueOf = (request: BoundCatalogueRequest): Result<CatalogueHolding, VersionTwoLoadFailure> => {
  const located = { fileText: request.fileText, path: request.path, ruleSetRoot: request.ruleSetRoot };
  const holding = request.symptomCatalogueOf(located).read({});
  if (holding.outcome === "failed") {
    return holding;
  }
  const bindings = request.engineBindingsOf({ ...located, installRoot: request.installRoot }).read({});
  if (bindings.outcome === "failed") {
    return bindings;
  }
  const bound = holdingBoundTo({ holding: holding.value, bindings: bindings.value });
  return bound.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-malformed", path: request.path.join({ segments: [request.ruleSetRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] }), detail: bound.error } }
    : bound;
};

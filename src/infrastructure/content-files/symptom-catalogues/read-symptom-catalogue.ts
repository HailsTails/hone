import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { readVersionOneJson } from "../rule-sets/rule-set-reader.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { CatalogueHolding } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { SymptomCatalogueRepository } from "../../../application/ports/symptom-catalogue-repository.ts";
import { symptomCatalogueOf } from "./symptom-catalogue-wire.ts";

export const SYMPTOM_CATALOGUE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.json"];

type CatalogueSource = {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
};

const readSymptomCatalogue = (request: CatalogueSource): Result<CatalogueHolding, VersionTwoLoadFailure> => {
  const path = request.path.join({ segments: [request.ruleSetRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] });
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: { held: "none" } };
  }
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const catalogue = symptomCatalogueOf({ document: document.value });
  return catalogue.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-malformed", path, detail: catalogue.error } }
    : { outcome: "ok", value: { held: "catalogue", catalogue: catalogue.value } };
};

export const createSymptomCatalogueRepository = (options: CatalogueSource): SymptomCatalogueRepository => ({
  read: (_request) => readSymptomCatalogue(options),
});

import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { BoundCatalogueOf } from "../../../application/ports/symptom-catalogue-repository.ts";
import { holdingBoundTo } from "../../../domain/language-layer/catalogue-binding.ts";
import { SYMPTOM_CATALOGUE_SEGMENTS } from "../../../domain/language-layer/symptom-catalogue-location.ts";
import type { CatalogueHolding } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { createEngineBindingsRepository } from "../../engines/piece-engines.ts";
import { createSymptomCatalogueRepository } from "./read-symptom-catalogue.ts";

type BoundCatalogueSource = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

export const readBoundCatalogue = (
  source: BoundCatalogueSource,
): Result<CatalogueHolding, VersionTwoLoadFailure> => {
  const holding = createSymptomCatalogueRepository(source).read({});
  if (holding.outcome === "failed") {
    return holding;
  }
  const checks = holding.value.held === "catalogue" ? holding.value.content.checks : [];
  const bindings = createEngineBindingsRepository(source).read({ checks });
  if (bindings.outcome === "failed") {
    return bindings;
  }
  const bound = holdingBoundTo({ holding: holding.value, bindings: bindings.value });
  return bound.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "file-malformed",
          path: source.path.join({ segments: [source.ruleSetRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] }),
          detail: bound.error,
        },
      }
    : bound;
};

export const createBoundCatalogueOf = (options: {
  readonly directory: DirectoryPort;
}): BoundCatalogueOf => {
  const boundCatalogueOf: BoundCatalogueOf = (request) =>
    readBoundCatalogue({ ...request, directory: options.directory });
  return boundCatalogueOf;
};

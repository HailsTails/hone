import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { Result } from "../../../domain/result.ts";
import type { EngineCheck } from "../../ports/engine/engine-run.ts";
import { toolCatalogueOf } from "../tool-catalogue.ts";
import { mapCataloguesToEngineChecks } from "./engine-checks.ts";

export const mapToolCatalogueToEngineChecks = (
  request: Parameters<typeof toolCatalogueOf>[0],
): Result<readonly EngineCheck[], RunLoadFailure> => {
  const catalogue = toolCatalogueOf(request);
  return catalogue.outcome === "failed"
    ? catalogue
    : mapCataloguesToEngineChecks({ catalogues: [catalogue.value] });
};

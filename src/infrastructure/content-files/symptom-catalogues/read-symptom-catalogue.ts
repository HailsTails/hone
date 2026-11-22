import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { SymptomCatalogueOf, SymptomCatalogueRepository } from "../../../application/ports/symptom-catalogue-repository.ts";
import { SYMPTOM_CATALOGUE_SEGMENTS } from "../../../domain/language-layer/symptom-catalogue-location.ts";
import type { ContentHolding } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { readVersionOneNames, VERSION_ONE_NAMES_SEGMENTS } from "../../disciplines-file/version-one-names.ts";
import { ENGINE_REGISTRY } from "../../engines/engine-registry.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { createItemFolderCatalogueRepository } from "../item-folders/read-item-folder-catalogue.ts";

type CatalogueSource = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
};

const readSymptomCatalogue = (request: CatalogueSource): Result<ContentHolding, VersionTwoLoadFailure> => {
  const itemRoot = request.path.join({ segments: [request.ruleSetRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] });
  const root = absolutePathSchema.safeParse(itemRoot);
  if (!root.success) {
    return { outcome: "failed", error: { kind: "file-unreadable", path: itemRoot, detail: "is not an absolute path" } };
  }
  const names = readVersionOneNames({ fileText: request.fileText, path: request.path.join({ segments: [request.ruleSetRoot, ...VERSION_ONE_NAMES_SEGMENTS] }) });
  if (names.outcome === "failed") {
    return names;
  }
  const beside = { engines: ENGINE_REGISTRY, clauses: names.value.clauses, clauseOfCheck: names.value.clauseOfCheck, formatsOfToday: names.value.formatsOfToday };
  return createItemFolderCatalogueRepository({ fileText: request.fileText, directory: request.directory, path: request.path, root: root.data, beside }).read({});
};

export const createSymptomCatalogueRepository = (options: CatalogueSource): SymptomCatalogueRepository => ({
  read: (_request) => readSymptomCatalogue(options),
});

export const createSymptomCatalogueOf = (options: { readonly directory: DirectoryPort }): SymptomCatalogueOf => {
  const catalogueOf: SymptomCatalogueOf = (request) => createSymptomCatalogueRepository({ ...request, directory: options.directory });
  return catalogueOf;
};

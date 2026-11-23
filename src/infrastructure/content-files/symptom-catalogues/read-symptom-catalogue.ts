import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { SymptomCatalogueRepository } from "../../../application/ports/symptom-catalogue-repository.ts";
import { SYMPTOM_CATALOGUE_SEGMENTS } from "../../../domain/language-layer/symptom-catalogue-location.ts";
import type { ContentHolding } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import {
  NO_VERSION_ONE_NAMES,
  readVersionOneNames,
  type VersionOneNames,
  VERSION_ONE_NAMES_SEGMENTS,
} from "../../disciplines-file/version-one-names.ts";
import { ENGINE_REGISTRY } from "../../engines/engine-registry.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { createItemFolderCatalogueRepository } from "../item-folders/read-item-folder-catalogue.ts";
import { catalogueClausesOf } from "../rule-sets/installed-pieces.ts";

type CatalogueSource = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly upgradeNames?: VersionOneNames;
};

const namesOfRuleSet = (request: CatalogueSource): Result<VersionOneNames, VersionTwoLoadFailure> =>
  request.upgradeNames !== undefined
    ? { outcome: "ok", value: request.upgradeNames }
    : request.ruleSetRoot === request.installRoot
      ? readVersionOneNames({
          fileText: request.fileText,
          path: request.path.join({
            segments: [request.installRoot, ...VERSION_ONE_NAMES_SEGMENTS],
          }),
        })
      : { outcome: "ok", value: NO_VERSION_ONE_NAMES };

type RulesLayout = "version-one" | "not-version-one";

const VERSION_ONE_RULE_FILE = "discipline.json";

const rulesLayoutOf = (
  request: CatalogueSource & { readonly itemRoot: AbsolutePath },
): Result<RulesLayout, VersionTwoLoadFailure> => {
  const entries = request.directory.list({ path: request.itemRoot });
  if (entries.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: entries.error.path, detail: entries.error.detail },
    };
  }
  const holdsRuleFile = entries.value.some(
    (entry) =>
      entry.kind === "directory" &&
      request.fileText.exists({
        path: request.path.join({
          segments: [request.itemRoot, entry.name, VERSION_ONE_RULE_FILE],
        }),
      }) === "present",
  );
  return { outcome: "ok", value: holdsRuleFile ? "version-one" : "not-version-one" };
};

const refusedWhenVersionOne = (
  request: CatalogueSource & {
    readonly itemRoot: AbsolutePath;
    readonly holding: ContentHolding;
  },
): Result<ContentHolding, VersionTwoLoadFailure> => {
  if (request.holding.held === "catalogue") {
    return { outcome: "ok", value: request.holding };
  }
  const layout = rulesLayoutOf(request);
  if (layout.outcome === "failed") {
    return layout;
  }
  return layout.value === "version-one"
    ? { outcome: "failed", error: { kind: "rule-set-not-upgraded", path: request.ruleSetRoot } }
    : { outcome: "ok", value: request.holding };
};

const readSymptomCatalogue = (
  request: CatalogueSource,
): Result<ContentHolding, VersionTwoLoadFailure> => {
  const itemRoot = request.path.join({
    segments: [request.ruleSetRoot, ...SYMPTOM_CATALOGUE_SEGMENTS],
  });
  const root = absolutePathSchema.safeParse(itemRoot);
  if (!root.success) {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: itemRoot, detail: "is not an absolute path" },
    };
  }
  const names = namesOfRuleSet(request);
  if (names.outcome === "failed") {
    return names;
  }
  const clauses = catalogueClausesOf({
    ...request,
    installRoot: request.ruleSetRoot,
    names: names.value,
  });
  if (clauses.outcome === "failed") {
    return clauses;
  }
  if (request.fileText.exists({ path: root.data }) === "absent") {
    return { outcome: "ok", value: { held: "none" } };
  }
  const beside = {
    engines: ENGINE_REGISTRY,
    clauses: clauses.value,
    clauseOfCheck: names.value.clauseOfCheck,
    formatsOfToday: names.value.formatsOfToday,
  };
  const holding = createItemFolderCatalogueRepository({
    fileText: request.fileText,
    directory: request.directory,
    path: request.path,
    root: root.data,
    beside,
    symptomSourcePrefix:
      request.ruleSetRoot === request.installRoot
        ? undefined
        : SYMPTOM_CATALOGUE_SEGMENTS.join("/"),
  }).read({});
  return holding.outcome === "failed"
    ? holding
    : refusedWhenVersionOne({ ...request, itemRoot: root.data, holding: holding.value });
};

export const createSymptomCatalogueRepository = (
  options: CatalogueSource,
): SymptomCatalogueRepository => ({
  read: (_request) => readSymptomCatalogue(options),
});

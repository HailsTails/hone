import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { SymptomCatalogueRepository } from "../../../application/ports/symptom-catalogue-repository.ts";
import { SYMPTOM_CATALOGUE_SEGMENTS } from "../../../domain/language-layer/symptom-catalogue-location.ts";
import type {
  ContentHolding,
  RecordKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetIdentity } from "../../../domain/rule-set/clause-address-types.ts";
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
  readonly ruleSet: RuleSetIdentity;
  readonly installRoot: AbsolutePath;
  readonly inheritedRecordKinds: readonly RecordKind[];
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

const VERSION_ONE_RULE_FILE = "discipline.json";

export const versionOneRuleFilesOf = (request: {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: Pick<PathPort, "join">;
  readonly itemRoot: AbsolutePath;
}): Result<readonly string[], VersionTwoLoadFailure> => {
  const entries = request.directory.list({ path: request.itemRoot });
  if (entries.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: entries.error.path, detail: entries.error.detail },
    };
  }
  return {
    outcome: "ok",
    value: entries.value.flatMap((entry) => {
      const path = request.path.join({
        segments: [request.itemRoot, entry.name, VERSION_ONE_RULE_FILE],
      });
      return entry.kind === "directory" && request.fileText.exists({ path }) === "present"
        ? [path]
        : [];
    }),
  };
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
  const files = versionOneRuleFilesOf(request);
  if (files.outcome === "failed") {
    return files;
  }
  return files.value.length > 0
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
    ruleSet: request.ruleSet,
    beside,
    inheritedRecordKinds: request.inheritedRecordKinds,
    sourcePrefix:
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
  read: () => readSymptomCatalogue(options),
});

import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { SymptomCatalogueRepository } from "../../../application/ports/symptom-catalogue-repository.ts";
import { checkAddressTextOf } from "../../../domain/language-layer/check-address-text.ts";
import type {
  CatalogueContent,
  ContentHolding,
  RecordKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetIdentity } from "../../../domain/rule-set/clause-address-types.ts";
import { catalogueContentFromFile } from "../symptom-catalogues/symptom-catalogue-wire.ts";
import { catalogueFileOf, type HeldBesideItems, type PlacedItem } from "./item-document.ts";
import { itemFactsOf } from "./item-facts.ts";
import { fileRoleOf, identityOf } from "./item-identity.ts";
import { filesUnder } from "./item-listing.ts";
import { itemTextOf } from "./item-text.ts";

type ItemFolder = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: Pick<PathPort, "join">;
  readonly root: AbsolutePath;
  readonly ruleSet: RuleSetIdentity;
  readonly beside: HeldBesideItems;
  readonly inheritedRecordKinds: readonly RecordKind[];
  readonly sourcePrefix?: string;
};

type ItemRead = Result<PlacedItem, VersionTwoLoadFailure>;

const malformed = (request: {
  readonly path: string;
  readonly detail: string;
}): VersionTwoLoadFailure => ({
  kind: "file-malformed",
  path: request.path,
  detail: request.detail,
});

const placedItemAt = (request: ItemFolder & { readonly file: string }): ItemRead => {
  const path = request.path.join({ segments: [request.root, request.file] });
  const identity = identityOf({ path: request.file });
  if (identity.outcome === "failed") {
    return { outcome: "failed", error: malformed({ path, detail: identity.error.refusal }) };
  }
  const text = request.fileText.read({ path });
  if (text.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path, detail: text.error.detail },
    };
  }
  const read = itemTextOf({ text: text.value });
  if (read.outcome === "failed") {
    return { outcome: "failed", error: malformed({ path, detail: read.error }) };
  }
  const facts = itemFactsOf({ kind: identity.value.kind, facts: read.value.facts });
  return facts.outcome === "failed"
    ? { outcome: "failed", error: malformed({ path, detail: facts.error }) }
    : {
        outcome: "ok",
        value: {
          name: identity.value.name,
          ...(request.sourcePrefix === undefined
            ? {}
            : { sourceFile: `${request.sourcePrefix}/${request.file}` }),
          within: identity.value.within,
          title: read.value.title,
          item: facts.value,
        },
      };
};

const placedItemsOf = (
  request: ItemFolder & { readonly files: readonly string[] },
): Result<readonly PlacedItem[], VersionTwoLoadFailure> => {
  const reads = request.files
    .filter((file) => fileRoleOf({ path: file }) === "item")
    .map((file) => placedItemAt({ ...request, file }));
  const failure = reads.find((each) => each.outcome === "failed");
  return failure?.outcome === "failed"
    ? failure
    : {
        outcome: "ok",
        value: reads.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
      };
};

const createSourceKey = (placed: PlacedItem): string =>
  placed.within === undefined
    ? placed.name
    : checkAddressTextOf({ check: { name: placed.name, symptom: { name: placed.within } } });

const mapItemsToSourceFiles = (request: {
  readonly items: readonly PlacedItem[];
  readonly kind: "symptom" | "check" | "recipe";
}): ReadonlyMap<string, string> =>
  new Map(
    request.items
      .filter((placed) => placed.item.kind === request.kind)
      .flatMap((placed) =>
        placed.sourceFile === undefined
          ? []
          : [[createSourceKey(placed), placed.sourceFile] as const],
      ),
  );

const addSourceFiles = (request: {
  readonly content: CatalogueContent;
  readonly items: readonly PlacedItem[];
}): CatalogueContent => {
  const symptomFiles = mapItemsToSourceFiles({ items: request.items, kind: "symptom" });
  const checkFiles = mapItemsToSourceFiles({ items: request.items, kind: "check" });
  const symptoms = request.content.symptoms.map((symptom) => {
    const sourceFile = symptomFiles.get(symptom.name);
    return sourceFile === undefined ? symptom : { ...symptom, sourceFile };
  });
  const recipeFiles = mapItemsToSourceFiles({ items: request.items, kind: "recipe" });
  const recipes = request.content.recipes.map((recipe) => {
    const sourceFile = recipeFiles.get(recipe.name);
    return sourceFile === undefined ? recipe : { ...recipe, sourceFile };
  });
  const checks = request.content.checks.map((check) => ({
    ...check,
    page: checkFiles.get(checkAddressTextOf({ check })) ?? check.page,
  }));
  return { ...request.content, recipes, symptoms, checks };
};

const holdingOf = (request: {
  readonly root: AbsolutePath;
  readonly ruleSet: RuleSetIdentity;
  readonly beside: HeldBesideItems;
  readonly inheritedRecordKinds: readonly RecordKind[];
  readonly items: readonly PlacedItem[];
}): Result<ContentHolding, VersionTwoLoadFailure> => {
  const file = catalogueFileOf({ items: request.items, beside: request.beside });
  const content =
    file.outcome === "failed"
      ? file
      : catalogueContentFromFile({
          file: file.value,
          ruleSet: request.ruleSet,
          inheritedRecordKinds: request.inheritedRecordKinds,
        });
  if (content.outcome === "failed") {
    return { outcome: "failed", error: malformed({ path: request.root, detail: content.error }) };
  }
  return {
    outcome: "ok",
    value: {
      held: "catalogue",
      content: addSourceFiles({ content: content.value, items: request.items }),
    },
  };
};

const readItemFolderCatalogue = (
  request: ItemFolder,
): Result<ContentHolding, VersionTwoLoadFailure> => {
  const files = filesUnder(request);
  if (files.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: files.error.path, detail: files.error.detail },
    };
  }
  const items = placedItemsOf({ ...request, files: files.value });
  if (items.outcome === "failed") {
    return items;
  }
  return items.value.length === 0
    ? { outcome: "ok", value: { held: "none" } }
    : holdingOf({ ...request, items: items.value });
};

export const createItemFolderCatalogueRepository = (
  options: ItemFolder,
): SymptomCatalogueRepository => ({
  read: () => readItemFolderCatalogue(options),
});

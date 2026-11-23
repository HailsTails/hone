import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { SymptomCatalogueRepository } from "../../../application/ports/symptom-catalogue-repository.ts";
import type {
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
  readonly symptomSourcePrefix?: string;
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
          ...(request.symptomSourcePrefix === undefined || identity.value.kind !== "symptom"
            ? {}
            : { sourceFile: `${request.symptomSourcePrefix}/${request.file}` }),
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
  const sourceFiles = new Map<string, string>();
  for (const { name, sourceFile } of request.items) {
    if (sourceFile !== undefined) sourceFiles.set(name, sourceFile);
  }
  if (sourceFiles.size === 0) {
    return { outcome: "ok", value: { held: "catalogue", content: content.value } };
  }
  const symptoms = content.value.symptoms.map((symptom) => ({
    ...symptom,
    sourceFile: sourceFiles.get(symptom.name),
  }));
  const byName = new Map(symptoms.map((symptom) => [symptom.name, symptom]));
  const checks = content.value.checks.map((check) => ({
    ...check,
    symptom: byName.get(check.symptom.name) ?? check.symptom,
  }));
  return {
    outcome: "ok",
    value: { held: "catalogue", content: { ...content.value, symptoms, checks } },
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
  read: (_request) => readItemFolderCatalogue(options),
});

import { isCatalogueName } from "../../../domain/language-layer/catalogue-name.ts";
import type { Result } from "../../../domain/result.ts";
import { recordKindNameSchema } from "../symptom-catalogues/symptom-catalogue-wire.ts";

export type ItemKind = "principle" | "rule" | "case" | "recipe" | "record-kind" | "symptom" | "check";

export type ItemIdentity = {
  readonly kind: ItemKind;
  readonly name: string;
  readonly within: string | undefined;
};

export type FileRole = "item" | "other";

type Placement = Result<ItemIdentity, { readonly refusal: string }>;

const ITEM_EXTENSION = ".md";

const LIST_PAGE_FILE = "README.md";

const SEGMENT_SEPARATOR = "/";

const ROOT_KIND_FOLDERS: ReadonlyMap<string, ItemKind> = new Map<string, ItemKind>([
  ["principles", "principle"],
  ["rules", "rule"],
  ["cases", "case"],
  ["record-kinds", "record-kind"],

]);

const LANGUAGE_KIND_FOLDERS: ReadonlyMap<string, ItemKind> = new Map<string, ItemKind>([
  ["symptoms", "symptom"],
  ["recipes", "recipe"],
]);

const CHECKS_UNDER = "symptoms";

const NOT_A_NAME = "is not a lower-case hyphenated name";

const placed = (identity: ItemIdentity): Placement => ({ outcome: "ok", value: identity });

const refused = (refusal: string): Placement => ({ outcome: "failed", error: { refusal } });

const nameRefusalOf = (request: { readonly kind: ItemKind; readonly name: string }): string | undefined => {
  switch (request.kind) {
    case "record-kind":
      return recordKindNameSchema.safeParse(request.name).success ? undefined : `${request.name} is not the name of a record kind`;
    case "principle":
    case "rule":
    case "case":
    case "recipe":
    case "symptom":
    case "check":
      return isCatalogueName(request.name) ? undefined : `${request.name} ${NOT_A_NAME}`;
  }
};

const named = (request: ItemIdentity): Placement => {
  const refusal = nameRefusalOf(request);
  return refusal === undefined ? placed(request) : refused(refusal);
};

const checkOf = (request: { readonly stem: string; readonly symptom: string }): Placement =>
  isCatalogueName(request.symptom)
    ? named({ kind: "check", name: request.stem, within: request.symptom })
    : refused(`${request.symptom} ${NOT_A_NAME}, and a check sits in the folder of its symptom`);

const placementOfFolders = (request: { readonly folders: readonly string[]; readonly stem: string }): Placement => {
  const [first, second, third] = request.folders;
  const rootKind = first === undefined ? undefined : ROOT_KIND_FOLDERS.get(first);
  const languageKind = second === undefined ? undefined : LANGUAGE_KIND_FOLDERS.get(second);
  if (request.folders.length === 1 && rootKind !== undefined) {
    return named({ kind: rootKind, name: request.stem, within: undefined });
  }
  if (request.folders.length === 2 && languageKind !== undefined) {
    return named({ kind: languageKind, name: request.stem, within: undefined });
  }
  if (request.folders.length === 3 && second === CHECKS_UNDER && third !== undefined) {
    return checkOf({ stem: request.stem, symptom: third });
  }
  return refused("sits where no kind of item is kept");
};

const segmentsOf = (request: { readonly path: string }): readonly string[] => request.path.split(SEGMENT_SEPARATOR);

const fileOf = (request: { readonly path: string }): string => segmentsOf(request).at(-1) ?? "";

type FolderPlace = "under-a-kind-folder" | "elsewhere";

const folderPlaceOf = (request: { readonly folders: readonly string[] }): FolderPlace => {
  const [first, second] = request.folders;
  const underRootKind = first !== undefined && ROOT_KIND_FOLDERS.has(first);
  const underLanguageKind = second !== undefined && LANGUAGE_KIND_FOLDERS.has(second);
  return underRootKind || underLanguageKind ? "under-a-kind-folder" : "elsewhere";
};

export const fileRoleOf = (request: { readonly path: string }): FileRole => {
  const file = fileOf(request);
  return file !== LIST_PAGE_FILE && file.endsWith(ITEM_EXTENSION) && folderPlaceOf({ folders: segmentsOf(request).slice(0, -1) }) === "under-a-kind-folder" ? "item" : "other";
};

export const identityOf = (request: { readonly path: string }): Placement =>
  placementOfFolders({ folders: segmentsOf(request).slice(0, -1), stem: fileOf(request).slice(0, -ITEM_EXTENSION.length) });

import { catalogueFileOf, type PlacedItem } from "../../../src/infrastructure/content-files/item-folders/item-document.ts";
import { itemFactsOf } from "../../../src/infrastructure/content-files/item-folders/item-facts.ts";
import { fileRoleOf, identityOf } from "../../../src/infrastructure/content-files/item-folders/item-identity.ts";
import { itemTextOf } from "../../../src/infrastructure/content-files/item-folders/item-text.ts";
import { parsedJson } from "../../../src/infrastructure/content-files/parsed-json.ts";
import { VERSION_ONE_NAMES_SEGMENTS, type VersionOneNames, versionOneNamesOf } from "../../../src/infrastructure/disciplines-file/version-one-names.ts";
import { ENGINE_REGISTRY } from "../../../src/infrastructure/engines/engine-registry.ts";
import type { CataloguePage, ItemPathPort, Rendered } from "./catalogue-page.ts";
import { casesPageOf } from "./cases-page.ts";
import { checksPageOf } from "./checks-page.ts";
import { principlesPageOf } from "./principles-page.ts";
import { recipesPageOf } from "./recipes-page.ts";
import { rulesPageOf } from "./rules-page.ts";
import { symptomsPageOf } from "./symptoms-page.ts";

type SourceFile = { readonly path: string; readonly text: string };

type ProsedItem = { readonly placed: PlacedItem; readonly path: string; readonly prose: string };


const RULES_FOLDER = "rules/";

const NAMES_PATH = VERSION_ONE_NAMES_SEGMENTS.join("/");

const prosedItemOf = (request: { readonly file: SourceFile; readonly path: string }): Rendered<ProsedItem> => {
  const identity = identityOf({ path: request.path });
  if (identity.outcome === "failed") {
    return { outcome: "failed", error: `${request.file.path} ${identity.error.refusal}` };
  }
  const text = itemTextOf({ text: request.file.text });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: `${request.file.path} ${text.error}` };
  }
  const facts = itemFactsOf({ kind: identity.value.kind, facts: text.value.facts });
  return facts.outcome === "failed"
    ? { outcome: "failed", error: `${request.file.path} ${facts.error}` }
    : {
        outcome: "ok",
        value: {
          placed: { name: identity.value.name, within: identity.value.within, title: text.value.title, item: facts.value },
          path: request.path,
          prose: text.value.prose,
        },
      };
};

const prosedItemsOf = (request: { readonly files: readonly SourceFile[] }): Rendered<readonly ProsedItem[]> => {
  const read = request.files
    .filter((file) => file.path.startsWith(RULES_FOLDER))
    .map((file) => ({ file, path: file.path.slice(RULES_FOLDER.length) }))
    .filter(({ path }) => fileRoleOf({ path }) === "item")
    .toSorted((left, right) => (left.path < right.path ? -1 : 1))
    .map(prosedItemOf);
  const failure = read.find((each) => each.outcome === "failed");
  return failure?.outcome === "failed" ? failure : { outcome: "ok", value: read.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])) };
};

const namesIn = (request: { readonly files: readonly SourceFile[] }): Rendered<VersionOneNames> => {
  const file = request.files.find((each) => each.path === NAMES_PATH);
  if (file === undefined) {
    return { outcome: "failed", error: `${NAMES_PATH} is not among the files` };
  }
  const document = parsedJson({ text: file.text });
  return document.outcome === "failed" ? document : versionOneNamesOf({ document: document.value });
};

export const cataloguePagesOf = (request: { readonly files: readonly SourceFile[]; readonly path: ItemPathPort }): Rendered<readonly CataloguePage[]> => {
  const names = namesIn(request);
  if (names.outcome === "failed") {
    return names;
  }
  const items = prosedItemsOf(request);
  if (items.outcome === "failed") {
    return items;
  }
  const file = catalogueFileOf({
    items: items.value.map((each) => each.placed),
    beside: { engines: ENGINE_REGISTRY, clauses: names.value.clauses, clauseOfCheck: names.value.clauseOfCheck, formatsOfToday: names.value.formatsOfToday },
  });
  if (file.outcome === "failed") {
    return file;
  }
  const source = { file: file.value, prose: new Map(items.value.map((each): readonly [string, string] => [each.path, each.prose])), path: request.path };
  const cases = casesPageOf(source);
  if (cases.outcome === "failed") {
    return cases;
  }
  const symptoms = symptomsPageOf(source);
  return symptoms.outcome === "failed"
    ? symptoms
    : { outcome: "ok", value: [principlesPageOf(source), rulesPageOf(source), cases.value, recipesPageOf(source), symptoms.value, checksPageOf(source)] };
};

import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { blocksOf, type CataloguePage, itemPaths, type PageSource, pageOf, pointedTitleOf, principleOfPointed, proseAt } from "./catalogue-page.ts";

const PAGE = "cases.md";

type Case = CatalogueFile["cases"][number];

const TABLE_HEAD = "| Case | Owes | What to do |\n|---|---|---|";

const decidingPrincipleOf = (request: { readonly file: CatalogueFile; readonly entry: Case }): string => {
  const [first] = request.entry.owes;
  return first === undefined ? "" : principleOfPointed({ file: request.file, point: first });
};

const rowOf = (request: PageSource & { readonly entry: Case }): string => {
  const title = request.entry.standing === "proposed" ? `${request.entry.title} (proposed)` : request.entry.title;
  const owes = request.entry.owes.map((point) => pointedTitleOf({ file: request.file, point })).join("; ");
  return `| ${title} | ${owes} | ${proseAt({ prose: request.prose, path: itemPaths.case(request.entry), pagePath: PAGE })} |`;
};

const principleBlockOf = (request: PageSource & { readonly principle: CatalogueFile["principles"][number] }): string => {
  const cases = request.file.cases.filter((entry) => decidingPrincipleOf({ file: request.file, entry }) === request.principle.name);
  return cases.length === 0 ? "" : blocksOf({ blocks: [`## ${request.principle.title}`, [TABLE_HEAD, ...cases.map((entry) => rowOf({ ...request, entry }))].join("\n")] });
};

export const casesPageOf = (request: PageSource): CataloguePage =>
  pageOf({ path: `rules/${PAGE}`, blocks: ["# Cases", ...request.file.principles.map((principle) => principleBlockOf({ ...request, principle }))] });

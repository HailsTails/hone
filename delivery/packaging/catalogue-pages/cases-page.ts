import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { blocksOf, type CataloguePage, everyRendered, itemPaths, type PageSource, pageOf, pointedTitleOf, principleOfPointed, proseAt, type Rendered } from "./catalogue-page.ts";

const PAGE = "cases.md";

type Case = CatalogueFile["cases"][number];

type PlacedCase = { readonly principle: string; readonly row: string };

const TABLE_HEAD = "| Case | Owes | What to do |\n|---|---|---|";

const decidingPrincipleOf = (request: { readonly file: CatalogueFile; readonly entry: Case }): Rendered<string> => {
  const [first] = request.entry.owes;
  return first === undefined ? { outcome: "failed", error: `the case ${request.entry.name} owes nothing` } : principleOfPointed({ file: request.file, point: first });
};

const rowOf = (request: PageSource & { readonly entry: Case }): Rendered<string> => {
  const titles = everyRendered({ entries: request.entry.owes, render: (point) => pointedTitleOf({ file: request.file, point }) });
  if (titles.outcome === "failed") {
    return titles;
  }
  const title = request.entry.standing === "proposed" ? `${request.entry.title} (proposed)` : request.entry.title;
  const prose = proseAt({ path: request.path, prose: request.prose, itemPath: itemPaths.case(request.entry), pagePath: PAGE });
  return { outcome: "ok", value: `| ${title} | ${titles.value.join("; ")} | ${prose} |` };
};

const placedCaseOf = (request: PageSource & { readonly entry: Case }): Rendered<PlacedCase> => {
  const principle = decidingPrincipleOf(request);
  if (principle.outcome === "failed") {
    return principle;
  }
  const row = rowOf(request);
  return row.outcome === "failed" ? row : { outcome: "ok", value: { principle: principle.value, row: row.value } };
};

const principleBlockOf = (request: { readonly principle: CatalogueFile["principles"][number]; readonly placed: readonly PlacedCase[] }): string => {
  const rows = request.placed.filter((placed) => placed.principle === request.principle.name).map((placed) => placed.row);
  return rows.length === 0 ? "" : blocksOf({ blocks: [`## ${request.principle.title}`, [TABLE_HEAD, ...rows].join("\n")] });
};

export const casesPageOf = (request: PageSource): Rendered<CataloguePage> => {
  const placed = everyRendered({ entries: request.file.cases, render: (entry) => placedCaseOf({ ...request, entry }) });
  return placed.outcome === "failed"
    ? placed
    : {
        outcome: "ok",
        value: pageOf({ path: `rules/${PAGE}`, blocks: ["# Cases", ...request.file.principles.map((principle) => principleBlockOf({ principle, placed: placed.value }))] }),
      };
};

import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { blocksOf, type CataloguePage, itemPaths, type PageSource, pageOf, proseAt } from "./catalogue-page.ts";

const PAGE = "typescript/checks.md";

type Symptom = CatalogueFile["symptoms"][number];

type Check = CatalogueFile["checks"][number];

const checkBlockOf = (request: PageSource & { readonly check: Check }): string =>
  blocksOf({
    blocks: [
      `### ${request.check.name}`,
      proseAt({ path: request.path, prose: request.prose, itemPath: itemPaths.check(request.check), pagePath: PAGE }),
    ],
  });

const symptomBlockOf = (request: PageSource & { readonly symptom: Symptom }): string => {
  const checks = request.file.checks.filter((check) => check.symptom === request.symptom.name);
  return checks.length === 0 ? "" : blocksOf({ blocks: [`## ${request.symptom.title}`, ...checks.map((check) => checkBlockOf({ ...request, check }))] });
};

export const checksPageOf = (request: PageSource): CataloguePage =>
  pageOf({ path: `rules/${PAGE}`, blocks: ["# Checks in TypeScript", ...request.file.symptoms.map((symptom) => symptomBlockOf({ ...request, symptom }))] });

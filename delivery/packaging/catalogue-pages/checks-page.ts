import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { blocksOf, type CataloguePage, type FactLabel, factLines, itemPaths, type PageSource, pageOf, proseAt } from "./catalogue-page.ts";

const PAGE = "typescript/checks.md";

type Symptom = CatalogueFile["symptoms"][number];

type Check = CatalogueFile["checks"][number];

const MARGIN_LABELS: readonly FactLabel<"flagsBeyondTheSymptom" | "misses" | "settingsTracedTo">[] = [
  { key: "flagsBeyondTheSymptom", label: "Flags beyond the symptom" },
  { key: "misses", label: "Misses" },
  { key: "settingsTracedTo", label: "Settings traced to" },
];

const marginLinesOf = (request: { readonly check: Check }): string =>
  factLines({ facts: request.check, labels: MARGIN_LABELS });

const checkBlockOf = (request: PageSource & { readonly check: Check }): string =>
  blocksOf({
    blocks: [
      `### ${request.check.name}`,
      marginLinesOf(request),
      proseAt({ path: request.path, prose: request.prose, itemPath: itemPaths.check(request.check), pagePath: PAGE }),
    ],
  });

const symptomBlockOf = (request: PageSource & { readonly symptom: Symptom }): string => {
  const checks = request.file.checks.filter((check) => check.symptom === request.symptom.name);
  return checks.length === 0 ? "" : blocksOf({ blocks: [`## ${request.symptom.title}`, ...checks.map((check) => checkBlockOf({ ...request, check }))] });
};

export const checksPageOf = (request: PageSource): CataloguePage =>
  pageOf({ path: `rules/${PAGE}`, blocks: ["# Checks in TypeScript", ...request.file.symptoms.map((symptom) => symptomBlockOf({ ...request, symptom }))] });

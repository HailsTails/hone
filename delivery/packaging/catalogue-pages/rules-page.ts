import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { anchorOf, blocksOf, type CataloguePage, itemPaths, type PageSource, pageOf, proseAt } from "./catalogue-page.ts";

const PAGE = "rules.md";

type Rule = CatalogueFile["rules"][number];

type Case = CatalogueFile["cases"][number];

const caseTitleOf = (request: { readonly served: Case }): string =>
  request.served.standing === "proposed" ? `${request.served.title} (proposed)` : request.served.title;

const casesServedOf = (request: { readonly file: CatalogueFile; readonly rule: Rule }): string => {
  const served = request.file.cases.filter((entry) => entry.owes.some((point) => "rule" in point && point.rule === request.rule.name));
  return served.length === 0 ? "" : `- **Cases served:** ${served.map((entry) => caseTitleOf({ served: entry })).join("; ")}.`;
};

const recipesOf = (request: { readonly file: CatalogueFile; readonly rule: Rule }): string => {
  const recipes = request.file.recipes.filter((recipe) => "rule" in recipe.serves && recipe.serves.rule === request.rule.name);
  return recipes.length === 0
    ? ""
    : `- **Recipes:** ${recipes.map((recipe) => `[${recipe.title}](typescript/recipes.md#${anchorOf({ title: recipe.title })})`).join(", ")}.`;
};

const ruleBlockOf = (request: PageSource & { readonly rule: Rule }): string =>
  blocksOf({
    blocks: [
      `### ${request.rule.title}`,
      request.rule.standing === "proposed" ? "Proposed, not accepted." : "",
      proseAt({ prose: request.prose, path: itemPaths.rule(request.rule), pagePath: PAGE }),
      [casesServedOf(request), recipesOf(request)].filter((line) => line.length > 0).join("\n"),
    ],
  });

const principleBlockOf = (request: PageSource & { readonly principle: CatalogueFile["principles"][number] }): string => {
  const rules = request.file.rules.filter((rule) => rule.principle === request.principle.name);
  return rules.length === 0 ? "" : blocksOf({ blocks: [`## ${request.principle.title}`, ...rules.map((rule) => ruleBlockOf({ ...request, rule }))] });
};

export const rulesPageOf = (request: PageSource): CataloguePage =>
  pageOf({ path: `rules/${PAGE}`, blocks: ["# Rules", ...request.file.principles.map((principle) => principleBlockOf({ ...request, principle }))] });

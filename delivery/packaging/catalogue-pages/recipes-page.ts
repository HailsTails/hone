import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { blocksOf, type CataloguePage, itemPaths, type PageSource, pageOf, proseAt } from "./catalogue-page.ts";

const PAGE = "typescript/recipes.md";

type Recipe = CatalogueFile["recipes"][number];

type Principle = CatalogueFile["principles"][number];

type Rule = CatalogueFile["rules"][number];

const reasonOf = (request: { readonly recipe: Recipe }): string =>
  request.recipe.reason.standing === "proposed"
    ? `- **Chosen because (proposed):** ${request.recipe.reason.text}`
    : `- **Chosen because:** ${request.recipe.reason.text}`;

const recipeBlockOf = (request: PageSource & { readonly recipe: Recipe; readonly level: string }): string =>
  blocksOf({
    blocks: [`${request.level} ${request.recipe.title}`, reasonOf(request), proseAt({ path: request.path, prose: request.prose, itemPath: itemPaths.recipe(request.recipe), pagePath: PAGE })],
  });

const ruleBlockOf = (request: PageSource & { readonly rule: Rule }): string => {
  const recipes = request.file.recipes.filter((recipe) => "rule" in recipe.serves && recipe.serves.rule === request.rule.name);
  return recipes.length === 0 ? "" : blocksOf({ blocks: [`### ${request.rule.title}`, ...recipes.map((recipe) => recipeBlockOf({ ...request, recipe, level: "####" }))] });
};

const principleBlockOf = (request: PageSource & { readonly principle: Principle }): string => {
  const direct = request.file.recipes.filter((recipe) => "principle" in recipe.serves && recipe.serves.principle === request.principle.name);
  const byRule = request.file.rules.filter((rule) => rule.principle === request.principle.name).map((rule) => ruleBlockOf({ ...request, rule }));
  const blocks = [...direct.map((recipe) => recipeBlockOf({ ...request, recipe, level: "###" })), ...byRule].filter((block) => block.length > 0);
  return blocks.length === 0 ? "" : blocksOf({ blocks: [`## ${request.principle.title}`, ...blocks] });
};

export const recipesPageOf = (request: PageSource): CataloguePage =>
  pageOf({
    path: `rules/${PAGE}`,
    blocks: ["# Recipes for TypeScript", ...request.file.principles.map((principle) => principleBlockOf({ ...request, principle }))],
  });

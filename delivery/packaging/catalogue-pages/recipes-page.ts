import { checkAddressOfNames } from "../../../src/domain/language-layer/check-address-text.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import {
  blocksOf,
  type CataloguePage,
  itemPaths,
  type PageSource,
  pageOf,
  proseAt,
} from "./catalogue-page.ts";

const PAGE = "typescript/recipes.md";

type Recipe = CatalogueFile["recipes"][number];

type Principle = CatalogueFile["principles"][number];

type Rule = CatalogueFile["rules"][number];

const reasonOf = (request: { readonly recipe: Recipe }): string =>
  request.recipe.reason.standing === "proposed"
    ? `- **Chosen because (proposed):** ${request.recipe.reason.text}`
    : `- **Chosen because:** ${request.recipe.reason.text}`;

type Example = NonNullable<Recipe["examples"]>[number];

type AnsweredForm = Example["answers"][number];

const mapAnswerToText = (request: { readonly answer: AnsweredForm }): string => {
  const { check, form } = request.answer;
  return `[${checkAddressOfNames(check)} ${form}](symptoms/${check.symptom}/${check.check}.md#${form})`;
};

const mapExampleToText = (request: {
  readonly recipe: Recipe;
  readonly example: Example;
}): string => {
  const { recipe, example } = request;
  const answers = example.answers.map((answer) => mapAnswerToText({ answer })).join(", ");
  return `[${example.anchor}](recipes/${recipe.name}.md#${example.anchor}) answers ${answers}`;
};

const mapRecipeToExamplesText = (request: { readonly recipe: Recipe }): string => {
  const examples = request.recipe.examples ?? [];
  return examples.length === 0
    ? ""
    : `- **Examples:** ${examples.map((example) => mapExampleToText({ ...request, example })).join("; ")}.`;
};

const PROSE_HEADING = /^(?=##+ )/gm;

const nestProse = (request: { readonly prose: string; readonly level: string }): string =>
  request.prose.replace(PROSE_HEADING, request.level.slice(1));

const recipeBlockOf = (
  request: PageSource & { readonly recipe: Recipe; readonly level: string },
): string =>
  blocksOf({
    blocks: [
      `${request.level} ${request.recipe.title}`,
      [reasonOf(request), mapRecipeToExamplesText(request)]
        .filter((line) => line.length > 0)
        .join("\n"),
      nestProse({
        level: request.level,
        prose: proseAt({
          path: request.path,
          prose: request.prose,
          itemPath: itemPaths.recipe(request.recipe),
          pagePath: PAGE,
        }),
      }),
    ],
  });

const ruleBlockOf = (request: PageSource & { readonly rule: Rule }): string => {
  const recipes = request.file.recipes.filter(({ serves }) =>
    serves.some((point) => "rule" in point && point.rule === request.rule.name),
  );
  return recipes.length === 0
    ? ""
    : blocksOf({
        blocks: [
          `### ${request.rule.title}`,
          ...recipes.map((recipe) => recipeBlockOf({ ...request, recipe, level: "####" })),
        ],
      });
};

const principleBlockOf = (request: PageSource & { readonly principle: Principle }): string => {
  const direct = request.file.recipes.filter(({ serves }) =>
    serves.some((point) => "principle" in point && point.principle === request.principle.name),
  );
  const byRule = request.file.rules
    .filter((rule) => rule.principle === request.principle.name)
    .map((rule) => ruleBlockOf({ ...request, rule }));
  const blocks = [
    ...direct.map((recipe) => recipeBlockOf({ ...request, recipe, level: "###" })),
    ...byRule,
  ].filter((block) => block.length > 0);
  return blocks.length === 0
    ? ""
    : blocksOf({ blocks: [`## ${request.principle.title}`, ...blocks] });
};

export const recipesPageOf = (request: PageSource): CataloguePage =>
  pageOf({
    path: `rules/${PAGE}`,
    blocks: [
      "# Recipes for TypeScript",
      ...request.file.principles.map((principle) => principleBlockOf({ ...request, principle })),
    ],
  });

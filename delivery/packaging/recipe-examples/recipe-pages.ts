import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../src/application/ports/host/path-port.ts";
import type {
  Recipe,
  RecipeExample,
} from "../../../src/domain/language-layer/symptom-catalogue.ts";
import { itemPaths } from "../catalogue-pages/catalogue-page.ts";
import { mapPageToExamples, type PageExample } from "./page-examples.ts";

export type ReadRecipePage = {
  readonly kind: "read";
  readonly recipe: string;
  readonly declared: readonly RecipeExample[];
  readonly shown: readonly PageExample[];
};

export type RecipePage =
  | ReadRecipePage
  | { readonly kind: "unreadable"; readonly recipe: string; readonly detail: string };

const RULES_FOLDER = "rules";

type PageSource = {
  readonly ruleSetRoot: string;
  readonly fileText: Pick<FileTextPort, "read">;
  readonly path: Pick<PathPort, "join">;
};

const readRecipePage = (
  request: PageSource & { readonly recipe: Pick<Recipe, "name" | "examples"> },
): RecipePage => {
  const { name, examples } = request.recipe;
  const text = request.fileText.read({
    path: request.path.join({
      segments: [request.ruleSetRoot, RULES_FOLDER, itemPaths.recipe({ name })],
    }),
  });
  return text.outcome === "failed"
    ? { kind: "unreadable", recipe: name, detail: text.error.detail }
    : {
        kind: "read",
        recipe: name,
        declared: examples ?? [],
        shown: mapPageToExamples({ text: text.value }),
      };
};

export const readRecipePages = (
  request: PageSource & { readonly recipes: readonly Pick<Recipe, "name" | "examples">[] },
): readonly RecipePage[] => request.recipes.map((recipe) => readRecipePage({ ...request, recipe }));

import { describe, expect, it } from "vitest";

import { catalogueNameOf } from "../../../src/domain/language-layer/catalogue-name.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { recipesPageOf } from "./recipes-page.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/install/rules" });

const FILE: CatalogueFile = {
  version: 1,
  principles: [
    { name: "one-place-decides", title: "One place decides" },
    { name: "tests-are-ours", title: "Tests are ours" },
  ],
  rules: [
    {
      name: "doer-or-orchestrator",
      title: "Doer or orchestrator",
      principle: "one-place-decides",
      standing: "accepted",
    },
    { name: "one-job", title: "One job", principle: "one-place-decides", standing: "accepted" },
  ],
  cases: [],
  recipes: [
    {
      name: "composition-root",
      title: "Composition root",
      serves: [{ rule: "doer-or-orchestrator" }],
      standing: "accepted",
      reason: { text: "Adapters are built once.", standing: "accepted" },
    },
    {
      name: "seam",
      title: "Seam",
      serves: [{ principle: "one-place-decides" }],
      standing: "accepted",
      reason: { text: "Seams split.", standing: "proposed" },
    },
  ],
  recordKinds: [],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("recipesPageOf", () => {
  it("renders the recipes serving a principle, then those serving each of its rules, leaving out what no recipe serves", () => {
    expect(
      recipesPageOf({
        file: FILE,
        path: PATH,
        prose: new Map([
          [
            "typescript/recipes/composition-root.md",
            "- **Method:** One entry builds; see [the port](port-in-a-module-of-its-own.md).",
          ],
        ]),
      }),
    ).toEqual({
      path: "rules/typescript/recipes.md",
      text: "# Recipes for TypeScript\n\n## One place decides\n\n### Seam\n\n- **Chosen because (proposed):** Seams split.\n\n### Doer or orchestrator\n\n#### Composition root\n\n- **Chosen because:** Adapters are built once.\n\n- **Method:** One entry builds; see [the port](recipes/port-in-a-module-of-its-own.md).\n",
    });
  });

  it("lists a recipe's examples by the check and form each answers, and nests its page's headings under its own", () => {
    const file: CatalogueFile = {
      ...FILE,
      recipes: [
        {
          name: "composition-root",
          title: "Composition root",
          serves: [{ rule: "doer-or-orchestrator" }],
          standing: "accepted",
          reason: { text: "Adapters are built once.", standing: "accepted" },
          examples: [
            {
              anchor: "a-let",
              answers: [
                {
                  check: {
                    symptom: catalogueNameOf("rebinding"),
                    check: catalogueNameOf("test-body"),
                  },
                  form: "a-let",
                },
                {
                  check: {
                    symptom: catalogueNameOf("branch-in-a-test"),
                    check: catalogueNameOf("test-body"),
                  },
                  form: "a-ternary",
                },
              ],
            },
            {
              anchor: "a-switch",
              answers: [
                {
                  check: {
                    symptom: catalogueNameOf("branch-in-a-test"),
                    check: catalogueNameOf("test-body"),
                  },
                  form: "a-switch",
                },
              ],
            },
          ],
        },
      ],
    };

    const page = recipesPageOf({
      file,
      path: PATH,
      prose: new Map([
        [
          "typescript/recipes/composition-root.md",
          "- **Method:** One.\n\n## Examples\n\n### A let",
        ],
      ]),
    });

    expect(page).toEqual({
      path: "rules/typescript/recipes.md",
      text: "# Recipes for TypeScript\n\n## One place decides\n\n### Doer or orchestrator\n\n#### Composition root\n\n- **Chosen because:** Adapters are built once.\n- **Examples:** [a-let](recipes/composition-root.md#a-let) answers [rebinding#test-body a-let](symptoms/rebinding/test-body.md#a-let), [branch-in-a-test#test-body a-ternary](symptoms/branch-in-a-test/test-body.md#a-ternary); [a-switch](recipes/composition-root.md#a-switch) answers [branch-in-a-test#test-body a-switch](symptoms/branch-in-a-test/test-body.md#a-switch).\n\n- **Method:** One.\n\n##### Examples\n\n###### A let\n",
    });
  });

  it("lists a recipe under each rule it serves", () => {
    const page = recipesPageOf({
      file: {
        ...FILE,
        cases: [],
        recipes: [
          {
            name: "composition-root",
            title: "Composition root",
            serves: [{ rule: "doer-or-orchestrator" }, { rule: "one-job" }],
            standing: "accepted",
            reason: { text: "Adapters are built once.", standing: "accepted" },
          },
        ],
      },
      path: PATH,
      prose: new Map(),
    });

    expect(page).toEqual({
      path: "rules/typescript/recipes.md",
      text: "# Recipes for TypeScript\n\n## One place decides\n\n### Doer or orchestrator\n\n#### Composition root\n\n- **Chosen because:** Adapters are built once.\n\n### One job\n\n#### Composition root\n\n- **Chosen because:** Adapters are built once.\n",
    });
  });
});

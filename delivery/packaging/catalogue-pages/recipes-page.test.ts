import { describe, expect, it } from "vitest";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { recipesPageOf } from "./recipes-page.ts";

const FILE: CatalogueFile = {
  version: 1,
  principles: [
    { name: "one-place-decides", title: "One place decides" },
    { name: "tests-are-ours", title: "Tests are ours" },
  ],
  rules: [
    { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: "one-place-decides", standing: "accepted" },
    { name: "one-job", title: "One job", principle: "one-place-decides", standing: "accepted" },
  ],
  cases: [],
  recipes: [
    {
      name: "composition-root",
      title: "Composition root",
      serves: { rule: "doer-or-orchestrator" },
      standing: "accepted",
      reason: { text: "Adapters are built once.", standing: "accepted" },
    },
    { name: "seam", title: "Seam", serves: { principle: "one-place-decides" }, standing: "accepted", reason: { text: "Seams split.", standing: "proposed" } },
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
        prose: new Map([["typescript/recipes/composition-root.md", "- **Method:** One entry builds; see [the port](port-in-the-domain.md)."]]),
      }),
    ).toEqual({
      path: "rules/typescript/recipes.md",
      text: "# Recipes for TypeScript\n\n## One place decides\n\n### Seam\n\n- **Chosen because (proposed):** Seams split.\n\n### Doer or orchestrator\n\n#### Composition root\n\n- **Chosen because:** Adapters are built once.\n\n- **Method:** One entry builds; see [the port](recipes/port-in-the-domain.md).\n",
    });
  });
});

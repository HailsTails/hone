import { describe, expect, it } from "vitest";

import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { rulesPageOf } from "./rules-page.ts";

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
    { name: "one-job", title: "One job", principle: "one-place-decides", standing: "proposed" },
  ],
  cases: [
    {
      name: "does-one-job",
      title: "Does one job",
      standing: "accepted",
      owes: [{ rule: "doer-or-orchestrator" }],
    },
    {
      name: "takes-a-dependency",
      title: "Takes a dependency",
      standing: "proposed",
      owes: [{ rule: "doer-or-orchestrator" }],
    },
    {
      name: "writes-tests",
      title: "Writes tests",
      standing: "accepted",
      owes: [{ principle: "tests-are-ours" }],
    },
  ],
  recipes: [
    {
      name: "composition-root",
      title: "Composition root",
      serves: [{ rule: "doer-or-orchestrator" }],
      standing: "accepted",
      reason: { text: "Adapters are built once.", standing: "accepted" },
    },
    {
      name: "stub-each-port",
      title: "Stub each port",
      serves: [{ principle: "tests-are-ours" }],
      standing: "accepted",
      reason: { text: "Tests own their stubs.", standing: "accepted" },
    },
  ],
  recordKinds: [],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("rulesPageOf", () => {
  it("renders each rule under its principle with its prose, the cases it serves and its recipes, leaving out a principle with no rules", () => {
    expect(
      rulesPageOf({
        file: FILE,
        path: PATH,
        prose: new Map([
          [
            "rules/doer-or-orchestrator.md",
            "- **What must hold:** A doer does. See [the case](../cases/does-one-job.md).",
          ],
        ]),
      }),
    ).toEqual({
      path: "rules/rules.md",
      text: "# Rules\n\n## One place decides\n\n### Doer or orchestrator\n\n- **What must hold:** A doer does. See [the case](cases/does-one-job.md).\n\n- **Cases served:** Does one job; Takes a dependency (proposed).\n- **Recipes:** [Composition root](typescript/recipes.md#composition-root).\n\n### One job\n\nProposed, not accepted.\n",
    });
  });

  it("lists a recipe under each rule it serves", () => {
    const page = rulesPageOf({
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
      path: "rules/rules.md",
      text: "# Rules\n\n## One place decides\n\n### Doer or orchestrator\n\n- **Recipes:** [Composition root](typescript/recipes.md#composition-root).\n\n### One job\n\nProposed, not accepted.\n\n- **Recipes:** [Composition root](typescript/recipes.md#composition-root).\n",
    });
  });
});

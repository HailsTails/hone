import { describe, expect, it } from "vitest";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { casesPageOf } from "./cases-page.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/install/rules" });

const FILE: CatalogueFile = {
  version: 1,
  principles: [
    { name: "one-place-decides", title: "One place decides" },
    { name: "no-hidden-effects", title: "No hidden effects" },
    { name: "tests-are-ours", title: "Tests are ours" },
  ],
  rules: [{ name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: "one-place-decides", standing: "accepted" }],
  cases: [
    { name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ rule: "doer-or-orchestrator" }, { principle: "tests-are-ours" }] },
    { name: "writes-tests", title: "Writes tests", standing: "proposed", owes: [{ principle: "tests-are-ours" }] },
  ],
  recipes: [],
  recordKinds: [],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("casesPageOf", () => {
  it("tables each case under the principle its first owed point sits under, leaving out a principle no case owes first", () => {
    expect(
      casesPageOf({ file: FILE, path: PATH, prose: new Map([["cases/does-one-job.md", "Split it into [doers](../rules/doer-or-orchestrator.md)."]]) }),
    ).toEqual({
      outcome: "ok",
      value: {
          path: "rules/cases.md",
          text: "# Cases\n\n## One place decides\n\n| Case | Owes | What to do |\n|---|---|---|\n| Does one job | Doer or orchestrator; Tests are ours | Split it into [doers](rules/doer-or-orchestrator.md). |\n\n## Tests are ours\n\n| Case | Owes | What to do |\n|---|---|---|\n| Writes tests (proposed) | Tests are ours |  |\n",
      },
    });
  });

  it("fails naming a rule a case owes that the rules do not hold", () => {
    const file: CatalogueFile = { ...FILE, cases: [{ name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ rule: "unheld-rule" }] }] };
    expect(casesPageOf({ file, path: PATH, prose: new Map() })).toEqual({ outcome: "failed", error: "the rules hold no unheld-rule" });
  });
});

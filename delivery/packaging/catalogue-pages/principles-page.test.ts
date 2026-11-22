import { describe, expect, it } from "vitest";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { principlesPageOf } from "./principles-page.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/install/rules" });

const FILE: CatalogueFile = {
  version: 1,
  principles: [
    { name: "one-place-decides", title: "One place decides" },
    { name: "tests-are-ours", title: "Tests are ours" },
    { name: "no-hidden-effects", title: "No hidden effects" },
  ],
  rules: [
    { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: "one-place-decides", standing: "accepted" },
    { name: "one-job", title: "One job", principle: "one-place-decides", standing: "proposed" },
    { name: "effects-named", title: "Effects named", principle: "no-hidden-effects", standing: "proposed" },
  ],
  cases: [],
  recipes: [],
  recordKinds: [],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("principlesPageOf", () => {
  it("renders each principle with its prose and the rules under it, accepted before proposed", () => {
    expect(
      principlesPageOf({
        file: FILE,
        path: PATH,
        prose: new Map([["principles/one-place-decides.md", "- **Must hold:** One decision, one unit. See [the rule](../rules/doer-or-orchestrator.md)."]]),
      }),
    ).toEqual({
      path: "rules/principles.md",
      text: "# Principles\n\n## One place decides\n\n- **Must hold:** One decision, one unit. See [the rule](rules/doer-or-orchestrator.md).\n\n- **Rules under it:** [Doer or orchestrator](rules.md#doer-or-orchestrator). Proposed, not accepted: [One job](rules.md#one-job).\n\n## Tests are ours\n\n- **Rules under it:** none. The principle decides.\n\n## No hidden effects\n\n- **Rules under it:** Proposed, not accepted: [Effects named](rules.md#effects-named).\n",
    });
  });
});

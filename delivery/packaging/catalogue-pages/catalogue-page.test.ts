import { describe, expect, it } from "vitest";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { anchorOf, blocksOf, itemPaths, pageOf, pointedTitleOf, principleOfPointed, proseAt, rebasedProse } from "./catalogue-page.ts";

const FILE: CatalogueFile = {
  version: 1,
  principles: [{ name: "one-place-decides", title: "One place decides" }],
  rules: [{ name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: "one-place-decides", standing: "accepted" }],
  cases: [],
  recipes: [],
  recordKinds: [],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("anchorOf", () => {
  it("lower-cases the title, drops punctuation and joins words with hyphens", () => {
    expect(anchorOf({ title: "Fix the declaration, not the value" })).toBe("fix-the-declaration-not-the-value");
  });

  it("keeps hyphens already in the title", () => {
    expect(anchorOf({ title: "Seen-to-breach reports" })).toBe("seen-to-breach-reports");
  });
});

describe("itemPaths", () => {
  it("places a principle in principles", () => {
    expect(itemPaths.principle({ name: "one-place-decides" })).toBe("principles/one-place-decides.md");
  });

  it("places a rule in rules", () => {
    expect(itemPaths.rule({ name: "doer-or-orchestrator" })).toBe("rules/doer-or-orchestrator.md");
  });

  it("places a case in cases", () => {
    expect(itemPaths.case({ name: "does-one-job" })).toBe("cases/does-one-job.md");
  });

  it("places a recipe in typescript/recipes", () => {
    expect(itemPaths.recipe({ name: "composition-root" })).toBe("typescript/recipes/composition-root.md");
  });

  it("places a symptom in typescript/symptoms", () => {
    expect(itemPaths.symptom({ name: "claimed-type" })).toBe("typescript/symptoms/claimed-type.md");
  });

  it("places a check in its symptom's folder", () => {
    expect(itemPaths.check({ symptom: "claimed-type", name: "cast-to-any" })).toBe("typescript/symptoms/claimed-type/cast-to-any.md");
  });
});

describe("rebasedProse", () => {
  it("points a link from a symptom to a recipe from the symptoms page instead", () => {
    expect(
      rebasedProse({ prose: "See [one](../recipes/one.md#method).", itemPath: "typescript/symptoms/claimed-type.md", pagePath: "typescript/symptoms.md" }),
    ).toBe("See [one](recipes/one.md#method).");
  });

  it("points a link from a principle to a rule from the principles page instead", () => {
    expect(rebasedProse({ prose: "[rule](../rules/doer.md)", itemPath: "principles/one-place-decides.md", pagePath: "principles.md" })).toBe("[rule](rules/doer.md)");
  });

  it("climbs out of the page's folder when the target lies outside it", () => {
    expect(
      rebasedProse({ prose: "[rule](../../../rules/doer.md)", itemPath: "typescript/symptoms/claimed-type/cast-to-any.md", pagePath: "typescript/checks.md" }),
    ).toBe("[rule](../rules/doer.md)");
  });

  it("keeps the climb of a link that leaves the rules folder", () => {
    expect(rebasedProse({ prose: "[doc](../../docs/adopting.md)", itemPath: "cases/does-one-job.md", pagePath: "typescript/symptoms.md" })).toBe(
      "[doc](../../docs/adopting.md)",
    );
  });

  it("drops a step that stays in the same folder", () => {
    expect(rebasedProse({ prose: "[sibling](./other.md)", itemPath: "rules/doer.md", pagePath: "rules.md" })).toBe("[sibling](rules/other.md)");
  });

  it("leaves a link to an outside address unchanged", () => {
    expect(rebasedProse({ prose: "[site](https://example.com/a)", itemPath: "rules/doer.md", pagePath: "rules.md" })).toBe("[site](https://example.com/a)");
  });

  it("leaves a link to an anchor on the same page unchanged", () => {
    expect(rebasedProse({ prose: "[above](#doer)", itemPath: "rules/doer.md", pagePath: "rules.md" })).toBe("[above](#doer)");
  });
});

describe("proseAt", () => {
  it("gives the item's prose rebased to the page", () => {
    expect(
      proseAt({ prose: new Map([["rules/doer.md", "[case](../cases/does-one-job.md)"]]), path: "rules/doer.md", pagePath: "rules.md" }),
    ).toBe("[case](cases/does-one-job.md)");
  });

  it("gives no prose for an item that has none", () => {
    expect(proseAt({ prose: new Map(), path: "rules/doer.md", pagePath: "rules.md" })).toBe("");
  });
});

describe("blocksOf", () => {
  it("separates the blocks by a blank line, leaving out empty ones", () => {
    expect(blocksOf({ blocks: ["# Title", "", "Body"] })).toBe("# Title\n\nBody");
  });
});

describe("pageOf", () => {
  it("joins the blocks and ends the text with a newline", () => {
    expect(pageOf({ path: "rules/rules.md", blocks: ["# Rules", "", "Body"] })).toEqual({ path: "rules/rules.md", text: "# Rules\n\nBody\n" });
  });
});

describe("pointedTitleOf", () => {
  it("gives a pointed rule's title", () => {
    expect(pointedTitleOf({ file: FILE, point: { rule: "doer-or-orchestrator" } })).toBe("Doer or orchestrator");
  });

  it("gives a pointed principle's title", () => {
    expect(pointedTitleOf({ file: FILE, point: { principle: "one-place-decides" } })).toBe("One place decides");
  });

  it("gives the name of a pointed rule the file does not hold", () => {
    expect(pointedTitleOf({ file: FILE, point: { rule: "unheld-rule" } })).toBe("unheld-rule");
  });

  it("gives the name of a pointed principle the file does not hold", () => {
    expect(pointedTitleOf({ file: FILE, point: { principle: "unheld-principle" } })).toBe("unheld-principle");
  });
});

describe("principleOfPointed", () => {
  it("gives the principle a pointed rule sits under", () => {
    expect(principleOfPointed({ file: FILE, point: { rule: "doer-or-orchestrator" } })).toBe("one-place-decides");
  });

  it("gives a pointed principle itself", () => {
    expect(principleOfPointed({ file: FILE, point: { principle: "one-place-decides" } })).toBe("one-place-decides");
  });

  it("gives the name of a pointed rule the file does not hold", () => {
    expect(principleOfPointed({ file: FILE, point: { rule: "unheld-rule" } })).toBe("unheld-rule");
  });
});

import { describe, expect, it } from "vitest";
import type { Case, Principle, Recipe, Rule, SymptomCatalogue } from "../src/domain/language-layer/symptom-catalogue.ts";
import {
  casesOfCatalogue,
  caseNamesOffTheirTitles,
  casesOnCasesPage,
  missingLinkSentencesOn,
  owesOfCatalogue,
  owesOnPages,
  type PageCase,
  type ProseLink,
  proposedReasonsOf,
  reasonMismatchesOf,
  recipeReasonsOnPage,
  unlinkedCaseSentencesOn,
  unlistedCaseNamesOn,
  unservedCaseNamesOn,
  unowedPointersOf,
} from "./catalogue-pages.ts";

const CASES_PAGE = `# Cases

## No hidden effects

| Case | Owes | What to do |
|---|---|---|
| Makes a new value from what it has | Effects; One place | It returns a new value. |
| Causes an effect (writes, logs, sends, exits) | Effects; Boundary, One place | The effect is a call on a port. |

### Proposed cases

| Case | Owes | What to do |
|---|---|---|
| Ships code for others | Outside risk | What we ship is visible. |

## Outside the cases

| Case | Owes | What to do |
|---|---|---|
| Not a case | Nothing | Nothing. |
`;

const PAGE_CASES: readonly PageCase[] = [
  { title: "Makes a new value from what it has", standing: "accepted" },
  { title: "Causes an effect (writes, logs, sends, exits)", standing: "accepted" },
  { title: "Ships code for others", standing: "proposed" },
];

describe("casesOnCasesPage", () => {
  it("reads each case row's title and standing, up to the cases outside the model", () => {
    expect(casesOnCasesPage({ text: CASES_PAGE })).toEqual([
      { title: "Makes a new value from what it has", standing: "accepted" },
      { title: "Causes an effect (writes, logs, sends, exits)", standing: "accepted" },
      { title: "Ships code for others", standing: "proposed" },
    ]);
  });
});

describe("unlistedCaseNamesOn", () => {
  it("names nothing when every case before an arrow is on the cases page, a proposed one marked proposed, past a test qualifier", () => {
    expect(
      unlistedCaseNamesOn({
        symptomsPage:
          "- **May indicate:** Makes a new value from what it has, Causes an effect (writes, logs, sends, exits) → Ports declared inside; Written-out answers. In a test: Makes a new value from what it has → Straight-through tests (\"quoted.\").\n- **May indicate:** Ships code for others (proposed) → Shipped risk declared (proposed, not accepted).\n- **Seen:** Makes a value → nothing.\n",
        cases: PAGE_CASES,
      }),
    ).toEqual([]);
  });

  it("reads the case before the situation an indication is about", () => {
    expect(
      unlistedCaseNamesOn({
        symptomsPage: "- **May indicate:** In a test: Makes a new value from what it has: a cast to build an input → Handed what it uses.\n",
        cases: PAGE_CASES,
      }),
    ).toEqual([]);
  });

  it("names each spelling before an arrow that is not a case on the cases page", () => {
    expect(
      unlistedCaseNamesOn({
        symptomsPage:
          "- **May indicate:** Makes a new value, Causes an effect (writes, logs, sends, exits) → Ports declared inside. Causes an effect → Written-out answers; Makes a new value from what it has (proposed) → One place decides.\n",
        cases: PAGE_CASES,
      }),
    ).toEqual(["Makes a new value, Causes an effect (writes, logs, sends, exits)", "Causes an effect", "Makes a new value from what it has (proposed)"]);
  });
});

describe("unservedCaseNamesOn", () => {
  it("names nothing when every case a rule serves, or would serve, is on the cases page", () => {
    expect(
      unservedCaseNamesOn({
        rulesPage:
          "### Ports declared inside\n\n- **Cases served:** Makes a new value from what it has; Causes an effect (writes, logs, sends, exits).\n\n### Shipped risk declared\n\n- **Case it would serve:** [Ships code for others](cases.md#proposed-cases) (proposed): what we ship is visible.\n",
        cases: PAGE_CASES,
      }),
    ).toEqual([]);
  });

  it("names each served case spelled otherwise than the cases page spells it", () => {
    expect(
      unservedCaseNamesOn({
        rulesPage: "- **Cases served:** Makes a new value; Causes an effect (writes, logs, sends, exits).\n- **Case it would serve:** [Ships code](cases.md#proposed-cases) (proposed).\n",
        cases: PAGE_CASES,
      }),
    ).toEqual(["Makes a new value", "Ships code"]);
  });
});

const RECIPES_PAGE = `# Recipes

## Tests

### Stub with vi.fn

- **Use:** a double.
- **Chosen because:** "Stubs return written-out values."

#### Composition root

- **Chosen because (proposed):** "One place builds."
`;

describe("recipeReasonsOnPage", () => {
  it("reads each recipe heading's reason and whether the page marks it proposed", () => {
    expect(recipeReasonsOnPage({ text: RECIPES_PAGE })).toEqual([
      { title: "Stub with vi.fn", reason: { text: "\"Stubs return written-out values.\"", standing: "accepted" } },
      { title: "Composition root", reason: { text: "\"One place builds.\"", standing: "proposed" } },
    ]);
  });
});

const STUB_WITH_VIFN: Recipe = {
  name: "stub-with-vifn",
  title: "Stub with vi.fn",
  standing: "accepted",
  reason: { text: "\"Stubs return written-out values.\"", standing: "accepted" },
};

const COMPOSITION_ROOT: Recipe = {
  name: "composition-root",
  title: "Composition root",
  standing: "accepted",
  reason: { text: "\"One place builds.\"", standing: "proposed" },
};

describe("reasonMismatchesOf", () => {
  it("names nothing when each recipe's reason and its standing are the page's", () => {
    expect(reasonMismatchesOf({ recipes: [STUB_WITH_VIFN, COMPOSITION_ROOT], page: recipeReasonsOnPage({ text: RECIPES_PAGE }) })).toEqual([]);
  });

  it("names a recipe whose reason is presented as settled where the page proposes it, one whose words differ, and one the page has no reason for", () => {
    expect(
      reasonMismatchesOf({
        recipes: [
          { ...COMPOSITION_ROOT, reason: { text: "\"One place builds.\"", standing: "accepted" } },
          { ...STUB_WITH_VIFN, reason: { text: "\"Stubs are simple.\"", standing: "accepted" } },
          { ...STUB_WITH_VIFN, name: "guard-clauses", title: "Guard clauses" },
        ],
        page: recipeReasonsOnPage({ text: RECIPES_PAGE }),
      }),
    ).toEqual(["composition-root", "stub-with-vifn", "guard-clauses"]);
  });
});

describe("proposedReasonsOf", () => {
  it("names each recipe whose reason is proposed, in catalogue order", () => {
    expect(proposedReasonsOf({ recipes: [STUB_WITH_VIFN, COMPOSITION_ROOT] })).toEqual(["composition-root"]);
  });
});

describe("casesOfCatalogue", () => {
  it("lists each catalogued case's title and standing in catalogue order", () => {
    const catalogue: Pick<SymptomCatalogue, "cases"> = {
      cases: [
        { name: "ships-code-for-others", title: "Ships code for others", standing: "proposed", owes: [] },
        { name: "makes-a-new-value-from-what-it-has", title: "Makes a new value from what it has", standing: "accepted", owes: [] },
      ],
    };
    expect(casesOfCatalogue({ catalogue })).toEqual([
      { title: "Ships code for others", standing: "proposed" },
      { title: "Makes a new value from what it has", standing: "accepted" },
    ]);
  });
});

const OWES_CASES_PAGE = `# Cases

Short names: Effects ([No hidden effects](principles.md#no-hidden-effects)), One place ([One place decides](principles.md#one-place-decides)), Boundary ([External behaviour sits at a boundary](principles.md#external-behaviour-sits-at-a-boundary)).

| Case | Owes | What to do |
|---|---|---|
| Makes a new value from what it has | Effects; One place | It returns a new value. |
| Causes an effect (writes, logs, sends, exits) | Effects; Boundary, One place | The effect is a call on a port. |
| Builds the real implementations | One place; Boundary | One place builds them. |
`;

const OWES_RULES_PAGE = `# Rules

## One place decides

### Doer or orchestrator

- **What must hold:** An orchestrator only calls.
- **Cases served:** Makes a new value from what it has.

### Ports declared inside

- **What must hold:** Business logic declares every port.
- **Cases served:** Causes an effect (writes, logs, sends, exits); Makes a new value from what it has.

Building every real implementation in one place at start-up is a case: Doer or orchestrator plus Ports declared inside give it.

The strictest checker setting is a case; the principle gives it.
`;

const BUILDING_LINK: ProseLink = {
  sentence: "Building every real implementation in one place at start-up is a case: Doer or orchestrator plus Ports declared inside give it.",
  cases: ["Builds the real implementations"],
};

describe("owesOnPages", () => {
  it("gives each case the principles its Owes column names, then the rules that serve it or that a prose link says give it, in the rules page's order", () => {
    expect(owesOnPages({ casesPage: OWES_CASES_PAGE, rulesPage: OWES_RULES_PAGE, links: [BUILDING_LINK] })).toEqual([
      {
        title: "Makes a new value from what it has",
        principles: ["no-hidden-effects", "one-place-decides"],
        rules: ["Doer or orchestrator", "Ports declared inside"],
      },
      {
        title: "Causes an effect (writes, logs, sends, exits)",
        principles: ["no-hidden-effects", "external-behaviour-sits-at-a-boundary", "one-place-decides"],
        rules: ["Ports declared inside"],
      },
      {
        title: "Builds the real implementations",
        principles: ["one-place-decides", "external-behaviour-sits-at-a-boundary"],
        rules: ["Doer or orchestrator", "Ports declared inside"],
      },
    ]);
  });

  it("names a short name the page does not define as unknown", () => {
    expect(
      owesOnPages({
        casesPage: "| Case | Owes | What to do |\n|---|---|---|\n| Makes a new value from what it has | Tests | It returns. |\n",
        rulesPage: "",
        links: [],
      }),
    ).toEqual([{ title: "Makes a new value from what it has", principles: ["unknown short name Tests"], rules: [] }]);
  });
});

describe("unlinkedCaseSentencesOn", () => {
  it("names each sentence that makes a case of rules and that no prose link lists", () => {
    expect(unlinkedCaseSentencesOn({ pages: [OWES_RULES_PAGE], links: [] })).toEqual([BUILDING_LINK.sentence]);
  });

  it("names nothing when every such sentence is a prose link, and passes over a case the principle alone gives", () => {
    expect(unlinkedCaseSentencesOn({ pages: [OWES_RULES_PAGE], links: [BUILDING_LINK] })).toEqual([]);
  });
});

describe("missingLinkSentencesOn", () => {
  it("names each prose link whose sentence no page holds", () => {
    expect(
      missingLinkSentencesOn({
        pages: [OWES_RULES_PAGE],
        links: [BUILDING_LINK, { sentence: "Guard first gives it.", cases: ["Builds the real implementations"] }],
      }),
    ).toEqual(["Guard first gives it."]);
  });
});

describe("owesOfCatalogue", () => {
  it("gives each case the names of the principles it owes and the titles of the rules it owes, in its order", () => {
    const onePlace: Principle = { name: "one-place-decides", title: "One place decides" };
    const doer: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: onePlace, standing: "accepted" };
    const builds: Case = {
      name: "builds-the-real-implementations",
      title: "Builds the real implementations",
      standing: "accepted",
      owes: [
        { kind: "principle", principle: onePlace },
        { kind: "rule", rule: doer },
      ],
    };
    expect(owesOfCatalogue({ catalogue: { cases: [builds] } })).toEqual([
      { title: "Builds the real implementations", principles: ["one-place-decides"], rules: ["Doer or orchestrator"] },
    ]);
  });
});

describe("unowedPointersOf", () => {
  it("names each pointer of an indication whose case does not owe it, by its title, and none that it owes", () => {
    const onePlace: Principle = { name: "one-place-decides", title: "One place decides" };
    const doer: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: onePlace, standing: "accepted" };
    const builds: Case = {
      name: "builds-the-real-implementations",
      title: "Builds the real implementations",
      standing: "accepted",
      owes: [{ kind: "principle", principle: onePlace }],
    };
    expect(
      unowedPointersOf({
        catalogue: {
          symptoms: [
            {
              name: "wide-port",
              mayIndicate: [
                {
                  case: builds,
                  points: [
                    { kind: "principle", principle: onePlace },
                    { kind: "rule", rule: doer },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([{ symptom: "wide-port", case: "builds-the-real-implementations", pointer: "Doer or orchestrator" }]);
  });
});

describe("caseNamesOffTheirTitles", () => {  type NamingRow = { readonly name: string; readonly entry: Pick<Case, "name" | "title">; readonly off: readonly string[] };

  it.each<NamingRow>([
    { name: "a name that is its title, hyphenated", entry: { name: "does-one-job", title: "Does one job" }, off: [] },
    {
      name: "a name that leaves out its title's parenthetical and punctuation",
      entry: { name: "causes-an-effect", title: "Causes an effect (writes, logs, sends, exits)" },
      off: [],
    },
    { name: "a name cut shorter than its title", entry: { name: "causes", title: "Causes an effect (writes, logs, sends, exits)" }, off: ["causes"] },
    {
      name: "a name that keeps its title's parenthetical",
      entry: { name: "gives-a-value-its-type-declares-it", title: "Gives a value its type (declares it, or needs it narrower)" },
      off: ["gives-a-value-its-type-declares-it"],
    },
  ])("names $name as off its title when it is", ({ entry, off }) => {
    expect(caseNamesOffTheirTitles({ cases: [entry] })).toEqual(off);
  });
});
import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import type { Case, Engine, Principle, Recipe, RecordKind, Rule, Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import { symptomCatalogueOf } from "./symptom-catalogue-wire.ts";

const RECORD_KINDS_DOCUMENT = [
  { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" },
  { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" },
];

const DOCUMENT = {
  version: 1,
  principles: [{ name: "no-hidden-effects", title: "No hidden effects" }],
  rules: [{ name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: "no-hidden-effects", standing: "accepted" }],
  cases: [
    { name: "makes-a-new-value-from-what-it-has", title: "Makes a new value from what it has", standing: "accepted", owes: [{ principle: "no-hidden-effects" }] },
    {
      name: "coordinates-other-units",
      title: "Coordinates other units",
      standing: "proposed",
      owes: [{ principle: "no-hidden-effects" }, { rule: "doer-or-orchestrator" }],
    },
  ],
  recipes: [{ name: "functional-iteration", title: "Functional iteration", standing: "accepted", reason: { text: "\"For of mutates by its nature.\"", standing: "proposed" } }],
  recordKinds: RECORD_KINDS_DOCUMENT,
  engines: [
    { name: "walker", mechanism: "audit" },
    { name: "eslint", mechanism: "eslint" },
  ],
  symptoms: [
    {
      name: "loop-keyword",
      title: "Loop keyword",
      seen: "`for` or `while`.",
      mayIndicate: [
        { case: "makes-a-new-value-from-what-it-has", points: [{ principle: "no-hidden-effects" }] },
        { case: "coordinates-other-units", points: [{ rule: "doer-or-orchestrator" }] },
      ],
      breachUsuallySits: "in the unit",
      recipes: ["functional-iteration"],
      correctUses: [
        { situation: "draining a stream", kind: "authorised-location", at: "in its source's adapter" },
        { situation: "a known stream", kind: "debt" },
      ],
    },
  ],
  clauses: [
    { clause: "CD-15#loops", sight: { kind: "one-symptom", symptom: "loop-keyword" } },
    { clause: "CD-27#test-body-logic", sight: { kind: "symptom-by-form", forms: [{ section: "a-let", symptom: "loop-keyword" }] } },
    { clause: "CD-9#result-failures", sight: { kind: "method", recipe: "functional-iteration", outcomeSeenBy: ["loop-keyword"] } },
    { clause: "CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
  ],
  checks: [
    { symptom: "loop-keyword", name: "loops", clause: "CD-15#loops", engines: ["walker", "eslint"] },
    { symptom: "loop-keyword", name: "test-body", clause: "CD-27#test-body-logic", engines: ["walker"] },
  ],
  namedBans: [{ outsideDependency: "lodash" }],
};

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: NO_HIDDEN_EFFECTS, standing: "accepted" };

const MAKES_A_NEW_VALUE: Case = {
  name: "makes-a-new-value-from-what-it-has",
  title: "Makes a new value from what it has",
  standing: "accepted",
  owes: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }],
};

const COORDINATES_OTHER_UNITS: Case = {
  name: "coordinates-other-units",
  title: "Coordinates other units",
  standing: "proposed",
  owes: [
    { kind: "principle", principle: NO_HIDDEN_EFFECTS },
    { kind: "rule", rule: DOER_OR_ORCHESTRATOR },
  ],
};

const FUNCTIONAL_ITERATION: Recipe = {
  name: "functional-iteration",
  title: "Functional iteration",
  standing: "accepted",
  reason: { text: "\"For of mutates by its nature.\"", standing: "proposed" },
};

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const WALKER: Engine = { name: "walker", mechanism: mechanismIdSchema.parse("audit") };

const ESLINT: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [
    { case: MAKES_A_NEW_VALUE, points: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }] },
    { case: COORDINATES_OTHER_UNITS, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit",
  recipes: [FUNCTIONAL_ITERATION],
  correctUses: [
    { situation: "draining a stream", kind: AUTHORISED_LOCATION, at: "in its source's adapter" },
    { situation: "a known stream", kind: DEBT },
  ],
};

const EMPTY_DOCUMENT = {
  version: 1,
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: RECORD_KINDS_DOCUMENT,
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

const PRINCIPLES_DOCUMENT = [
  { name: "no-hidden-effects", title: "No hidden effects" },
  { name: "one-place-decides", title: "One place decides" },
];

const CASE_DOCUMENT = {
  name: "checks-conditions-before-its-work",
  title: "Checks conditions before its work",
  standing: "accepted",
  owes: [{ principle: "no-hidden-effects" }],
};

const SYMPTOM_DOCUMENT = {
  name: "work-inside-a-condition",
  title: "Work inside a condition",
  seen: "An `if` inside another `if`.",
  mayIndicate: [{ case: "checks-conditions-before-its-work", points: [{ principle: "one-place-decides" }] }],
  breachUsuallySits: "in the unit's questions",
  recipes: [],
  correctUses: [],
};

const SYMPTOM_HOLDING_DOCUMENT = {
  ...EMPTY_DOCUMENT,
  principles: PRINCIPLES_DOCUMENT,
  cases: [CASE_DOCUMENT],
  engines: [{ name: "eslint", mechanism: "eslint" }],
  symptoms: [SYMPTOM_DOCUMENT],
  clauses: [{ clause: "CD-42#useless-else", sight: { kind: "one-symptom", symptom: "work-inside-a-condition" } }],
};

describe("symptomCatalogueOf", () => {
  it("resolves every name a document gives to the entry it names, field by field", () => {
    expect(symptomCatalogueOf({ document: DOCUMENT })).toEqual({
      outcome: "ok",
      value: {
        principles: [NO_HIDDEN_EFFECTS],
        rules: [DOER_OR_ORCHESTRATOR],
        cases: [MAKES_A_NEW_VALUE, COORDINATES_OTHER_UNITS],
        recipes: [FUNCTIONAL_ITERATION],
        recordKinds: [AUTHORISED_LOCATION, DEBT],
        alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
        engines: [WALKER, ESLINT],
        symptoms: [LOOP_KEYWORD],
        clauses: [
          { clause: clauseAddressSchema.parse("CD-15#loops"), sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
          { clause: clauseAddressSchema.parse("CD-27#test-body-logic"), sight: { kind: "symptom-by-form", forms: [{ section: "a-let", symptom: LOOP_KEYWORD }] } },
          { clause: clauseAddressSchema.parse("CD-9#result-failures"), sight: { kind: "method", recipe: FUNCTIONAL_ITERATION, outcomeSeenBy: [LOOP_KEYWORD] } },
          { clause: clauseAddressSchema.parse("CD-32#pii-redaction"), sight: { kind: "outside-the-cases" } },
        ],
        checks: [
          { name: "loops", symptom: LOOP_KEYWORD, clause: clauseAddressSchema.parse("CD-15#loops"), engines: [WALKER, ESLINT], forms: [] },
          { name: "test-body", symptom: LOOP_KEYWORD, clause: clauseAddressSchema.parse("CD-27#test-body-logic"), engines: [WALKER], forms: ["a-let"] },
        ],
        namedBans: [{ outsideDependency: "lodash" }],
      },
    });
  });

  it("gives a check on a clause that sees symptoms by form only the forms of its own symptom", () => {
    expect(
      symptomCatalogueOf({
        document: {
          ...SYMPTOM_HOLDING_DOCUMENT,
          symptoms: [SYMPTOM_DOCUMENT, { ...SYMPTOM_DOCUMENT, name: "rebinding", title: "Rebinding" }],
          clauses: [
            {
              clause: "CD-27#test-body-logic",
              sight: {
                kind: "symptom-by-form",
                forms: [
                  { section: "branching-with-if", symptom: "work-inside-a-condition" },
                  { section: "a-let", symptom: "rebinding" },
                  { section: "a-ternary", symptom: "work-inside-a-condition" },
                ],
              },
            },
          ],
          checks: [
            { symptom: "work-inside-a-condition", name: "test-body", clause: "CD-27#test-body-logic", engines: ["eslint"] },
            { symptom: "rebinding", name: "test-body", clause: "CD-27#test-body-logic", engines: ["eslint"] },
          ],
        },
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { checks: [{ name: "test-body", forms: ["branching-with-if", "a-ternary"] }, { name: "test-body", forms: ["a-let"] }] },
    });
  });

  it("reads the situation an indication of a case is about, and takes one case once in each situation", () => {
    expect(
      symptomCatalogueOf({
        document: {
          ...SYMPTOM_HOLDING_DOCUMENT,
          symptoms: [
            {
              ...SYMPTOM_DOCUMENT,
              mayIndicate: [
                { case: "checks-conditions-before-its-work", points: [{ principle: "one-place-decides" }] },
                { case: "checks-conditions-before-its-work", situation: "in a test, a cast to build an input", points: [{ principle: "no-hidden-effects" }] },
              ],
            },
          ],
        },
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        symptoms: [
          {
            mayIndicate: [
              { case: { name: "checks-conditions-before-its-work" }, points: [{ principle: { name: "one-place-decides" } }] },
              {
                case: { name: "checks-conditions-before-its-work" },
                situation: "in a test, a cast to build an input",
                points: [{ principle: { name: "no-hidden-effects" } }],
              },
            ],
          },
        ],
      },
    });
  });

  it("reads a catalogue that holds only the record kinds every symptom takes", () => {
    expect(symptomCatalogueOf({ document: EMPTY_DOCUMENT })).toEqual({
      outcome: "ok",
      value: {
        principles: [],
        rules: [],
        cases: [],
        recipes: [],
        recordKinds: [AUTHORISED_LOCATION, DEBT],
        alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
        engines: [],
        symptoms: [],
        clauses: [],
        checks: [],
        namedBans: [],
      },
    });
  });

  type RefusalRow = { readonly name: string; readonly document: unknown; readonly refusal: string };

  it.each<RefusalRow>([
    {
      name: "a name that is not lower-case and hyphenated",
      document: { ...EMPTY_DOCUMENT, principles: [{ name: "No hidden effects", title: "No hidden effects" }] },
      refusal: "✖ is not a lower-case hyphenated name\n  → at principles[0].name",
    },
    {
      name: "a principle listed twice",
      document: {
        ...EMPTY_DOCUMENT,
        principles: [
          { name: "no-hidden-effects", title: "No hidden effects" },
          { name: "no-hidden-effects", title: "No hidden effects" },
        ],
      },
      refusal: "✖ principles holds no-hidden-effects more than once",
    },
    {
      name: "a case listed twice",
      document: { ...SYMPTOM_HOLDING_DOCUMENT, cases: [CASE_DOCUMENT, CASE_DOCUMENT] },
      refusal: "✖ cases holds checks-conditions-before-its-work more than once",
    },
    {
      name: "an engine listed twice",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        engines: [
          { name: "eslint", mechanism: "eslint" },
          { name: "eslint", mechanism: "audit" },
        ],
      },
      refusal: "✖ engines holds eslint more than once",
    },
    {
      name: "a clause listed twice",
      document: {
        ...EMPTY_DOCUMENT,
        clauses: [
          { clause: "CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
          { clause: "hone/CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
        ],
      },
      refusal: "✖ clauses holds CD-32#pii-redaction more than once",
    },
    {
      name: "a form section listed twice for one clause",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        clauses: [
          {
            clause: "CD-27#test-body-logic",
            sight: {
              kind: "symptom-by-form",
              forms: [
                { section: "a-let", symptom: "work-inside-a-condition" },
                { section: "a-let", symptom: "work-inside-a-condition" },
              ],
            },
          },
        ],
      },
      refusal: "✖ the forms of CD-27#test-body-logic holds a-let more than once",
    },
    {
      name: "a check address listed twice",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        checks: [
          { symptom: "work-inside-a-condition", name: "useless-else", clause: "CD-42#useless-else", engines: ["eslint"] },
          { symptom: "work-inside-a-condition", name: "useless-else", clause: "CD-42#useless-else", engines: ["eslint"] },
        ],
      },
      refusal:
        "✖ checks holds work-inside-a-condition#useless-else more than once\n✖ the checks of work-inside-a-condition holds CD-42#useless-else more than once",
    },
    {
      name: "an engine listed twice under one mechanism",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        engines: [
          { name: "eslint", mechanism: "eslint" },
          { name: "linter", mechanism: "eslint" },
        ],
      },
      refusal: "✖ the mechanisms of engines holds eslint more than once",
    },
    {
      name: "two checks of one symptom on one clause",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        checks: [
          { symptom: "work-inside-a-condition", name: "useless-else", clause: "CD-42#useless-else", engines: ["eslint"] },
          { symptom: "work-inside-a-condition", name: "else-after-an-exit", clause: "hone/CD-42#useless-else", engines: ["eslint"] },
        ],
      },
      refusal: "✖ the checks of work-inside-a-condition holds CD-42#useless-else more than once",
    },
    {
      name: "a symptom naming one case twice in one situation",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        symptoms: [
          {
            ...SYMPTOM_DOCUMENT,
            mayIndicate: [
              { case: "checks-conditions-before-its-work", situation: "in a test", points: [{ principle: "one-place-decides" }] },
              { case: "checks-conditions-before-its-work", situation: "in a test", points: [{ principle: "no-hidden-effects" }] },
            ],
          },
        ],
      },
      refusal: "✖ the cases of work-inside-a-condition holds checks-conditions-before-its-work: in a test more than once",
    },
    {
      name: "a symptom naming one case twice",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        symptoms: [
          {
            ...SYMPTOM_DOCUMENT,
            mayIndicate: [
              { case: "checks-conditions-before-its-work", points: [{ principle: "one-place-decides" }] },
              { case: "checks-conditions-before-its-work", points: [{ principle: "no-hidden-effects" }] },
            ],
          },
        ],
      },
      refusal: "✖ the cases of work-inside-a-condition holds checks-conditions-before-its-work more than once",
    },
    {
      name: "a rule under a principle the catalogue does not hold",
      document: { ...EMPTY_DOCUMENT, rules: [{ name: "guard-first", title: "Guard first", principle: "one-place-decides", standing: "accepted" }] },
      refusal: "✖ rules names one-place-decides, which the catalogue does not hold",
    },
    {
      name: "a case owing a principle the catalogue does not hold",
      document: { ...EMPTY_DOCUMENT, cases: [CASE_DOCUMENT] },
      refusal: "✖ cases names no-hidden-effects, which the catalogue does not hold",
    },
    {
      name: "a case owing a rule the catalogue does not hold",
      document: { ...EMPTY_DOCUMENT, principles: PRINCIPLES_DOCUMENT, cases: [{ ...CASE_DOCUMENT, owes: [{ principle: "one-place-decides" }, { rule: "guard-first" }] }] },
      refusal: "✖ cases names guard-first, which the catalogue does not hold",
    },
    {
      name: "a case that owes nothing",
      document: { ...EMPTY_DOCUMENT, cases: [{ ...CASE_DOCUMENT, owes: [] }] },
      refusal: "✖ Too small: expected array to have >=1 items\n  → at cases[0].owes",
    },
    {
      name: "a symptom naming a case the catalogue does not hold",
      document: { ...SYMPTOM_HOLDING_DOCUMENT, cases: [] },
      refusal: "✖ symptoms names checks-conditions-before-its-work, which the catalogue does not hold",
    },
    {
      name: "a symptom pointing at a rule the catalogue does not hold",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        symptoms: [{ ...SYMPTOM_DOCUMENT, mayIndicate: [{ case: "checks-conditions-before-its-work", points: [{ rule: "guard-first" }] }] }],
      },
      refusal: "✖ symptoms names guard-first, which the catalogue does not hold",
    },
    {
      name: "a symptom pointing at a principle the catalogue does not hold",
      document: { ...SYMPTOM_HOLDING_DOCUMENT, principles: [{ name: "no-hidden-effects", title: "No hidden effects" }] },
      refusal: "✖ symptoms names one-place-decides, which the catalogue does not hold",
    },
    {
      name: "a symptom with a recipe the catalogue does not hold",
      document: { ...SYMPTOM_HOLDING_DOCUMENT, symptoms: [{ ...SYMPTOM_DOCUMENT, recipes: ["guard-clauses"] }] },
      refusal: "✖ symptoms names guard-clauses, which the catalogue does not hold",
    },
    {
      name: "a recipe without the reason it was chosen",
      document: { ...EMPTY_DOCUMENT, recipes: [{ name: "guard-clauses", title: "Guard clauses", standing: "accepted" }] },
      refusal: "✖ Invalid input: expected object, received undefined\n  → at recipes[0].reason",
    },
    {
      name: "a recipe reason that does not say whether it is accepted or proposed",
      document: { ...EMPTY_DOCUMENT, recipes: [{ name: "guard-clauses", title: "Guard clauses", standing: "accepted", reason: { text: "\"it reads flat\"" } }] },
      refusal: "✖ Invalid option: expected one of \"accepted\"|\"proposed\"\n  → at recipes[0].reason.standing",
    },
    {
      name: "a correct use by a record kind the catalogue does not hold",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        symptoms: [{ ...SYMPTOM_DOCUMENT, correctUses: [{ situation: "correct use", kind: "boundary-record", at: "on the clock adapter" }] }],
      },
      refusal: "✖ symptoms names boundary-record, which the catalogue does not hold",
    },
    {
      name: "a catalogue without debt, which every symptom takes",
      document: { ...EMPTY_DOCUMENT, recordKinds: [{ name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" }] },
      refusal: "✖ recordKinds holds no debt, which every symptom takes",
    },
    {
      name: "a catalogue without an authorised location, which every symptom takes",
      document: { ...EMPTY_DOCUMENT, recordKinds: [{ name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" }] },
      refusal: "✖ recordKinds holds no authorised-location, which every symptom takes",
    },
    {
      name: "a clause seeing a symptom the catalogue does not hold",
      document: { ...EMPTY_DOCUMENT, clauses: [{ clause: "CD-15#loops", sight: { kind: "one-symptom", symptom: "loop-keyword" } }] },
      refusal: "✖ clauses names loop-keyword, which the catalogue does not hold",
    },
    {
      name: "a clause demanding a recipe the catalogue does not hold",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        clauses: [{ clause: "CD-9#result-failures", sight: { kind: "method", recipe: "result-union", outcomeSeenBy: ["work-inside-a-condition"] } }],
      },
      refusal: "✖ clauses names result-union, which the catalogue does not hold",
    },
    {
      name: "a clause demanding a method whose outcome no symptom sees",
      document: {
        ...EMPTY_DOCUMENT,
        recipes: [{ name: "result-union", title: "Result union", standing: "accepted", reason: { text: "\"it makes the output clear\"", standing: "accepted" } }],
        clauses: [{ clause: "CD-9#result-failures", sight: { kind: "method", recipe: "result-union", outcomeSeenBy: [] } }],
      },
      refusal: "✖ Too small: expected array to have >=1 items\n  → at clauses[0].sight.outcomeSeenBy",
    },
    {
      name: "a check on a symptom the catalogue does not hold",
      document: { ...SYMPTOM_HOLDING_DOCUMENT, checks: [{ symptom: "rebinding", name: "useless-else", clause: "CD-42#useless-else", engines: ["eslint"] }] },
      refusal: "✖ checks names rebinding, which the catalogue does not hold",
    },
    {
      name: "a check on a clause the catalogue does not hold",
      document: { ...SYMPTOM_HOLDING_DOCUMENT, checks: [{ symptom: "work-inside-a-condition", name: "loops", clause: "CD-15#loops", engines: ["eslint"] }] },
      refusal: "✖ checks names CD-15#loops, which the catalogue does not hold",
    },
    {
      name: "a check run by an engine the catalogue does not hold",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        checks: [{ symptom: "work-inside-a-condition", name: "useless-else", clause: "CD-42#useless-else", engines: ["walker"] }],
      },
      refusal: "✖ checks names walker, which the catalogue does not hold",
    },
    {
      name: "a check run by no engine",
      document: { ...SYMPTOM_HOLDING_DOCUMENT, checks: [{ symptom: "work-inside-a-condition", name: "useless-else", clause: "CD-42#useless-else", engines: [] }] },
      refusal: "✖ Too small: expected array to have >=1 items\n  → at checks[0].engines",
    },
    {
      name: "a check on a symptom its clause does not see",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        symptoms: [SYMPTOM_DOCUMENT, { ...SYMPTOM_DOCUMENT, name: "rebinding", title: "Rebinding" }],
        checks: [{ symptom: "rebinding", name: "useless-else", clause: "CD-42#useless-else", engines: ["eslint"] }],
      },
      refusal: "✖ checks names rebinding#useless-else on CD-42#useless-else, which does not see rebinding",
    },
    {
      name: "a check on a clause that sees no symptom",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        clauses: [{ clause: "CD-32#pii-redaction", sight: { kind: "outside-the-cases" } }],
        checks: [{ symptom: "work-inside-a-condition", name: "pii-redaction", clause: "CD-32#pii-redaction", engines: ["eslint"] }],
      },
      refusal: "✖ checks names work-inside-a-condition#pii-redaction on CD-32#pii-redaction, which does not see work-inside-a-condition",
    },
    {
      name: "a clause with checks that sees a symptom no check names",
      document: {
        ...SYMPTOM_HOLDING_DOCUMENT,
        symptoms: [SYMPTOM_DOCUMENT, { ...SYMPTOM_DOCUMENT, name: "rebinding", title: "Rebinding" }],
        clauses: [
          {
            clause: "CD-27#test-body-logic",
            sight: {
              kind: "symptom-by-form",
              forms: [
                { section: "branching-with-if", symptom: "work-inside-a-condition" },
                { section: "a-let", symptom: "rebinding" },
              ],
            },
          },
        ],
        checks: [{ symptom: "work-inside-a-condition", name: "test-body", clause: "CD-27#test-body-logic", engines: ["eslint"] }],
      },
      refusal: "✖ CD-27#test-body-logic sees rebinding, which no check names",
    },
    {
      name: "a named ban that names nothing",
      document: { ...EMPTY_DOCUMENT, namedBans: [{ outsideDependency: "" }] },
      refusal: "✖ Too small: expected string to have >=1 characters\n  → at namedBans[0].outsideDependency",
    },
    {
      name: "a field the catalogue does not define",
      document: { ...EMPTY_DOCUMENT, numbers: [] },
      refusal: "✖ Unrecognized key: \"numbers\"",
    },
    {
      name: "a version other than 1",
      document: { ...EMPTY_DOCUMENT, version: 2 },
      refusal: "✖ Invalid input: expected 1\n  → at version",
    },
  ])("refuses $name", ({ document, refusal }) => {
    expect(symptomCatalogueOf({ document })).toEqual({ outcome: "failed", error: refusal });
  });
});

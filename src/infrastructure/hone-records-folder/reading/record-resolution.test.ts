import { describe, expect, it } from "vitest";

import type {
  Case,
  Check,
  Principle,
  Recipe,
  Rule,
  Symptom,
  SymptomAddress,
  SymptomCatalogue,
  AuthorisedLocationKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  HeldAs,
  OutsideParty,
  RecordsAtBase,
  SymptomReach,
} from "../../../domain/records/hone-records/hone-record.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import { owedBy, recordOf } from "./record-resolution.ts";

const THE_TYPE_CHECKER_PROVES_IT: Principle = {
  name: "the-type-checker-proves-it",
  title: "The type checker proves it",
};

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: THE_TYPE_CHECKER_PROVES_IT,
  standing: "accepted",
};

const STRAIGHT_THROUGH_TESTS: Rule = {
  name: "straight-through-tests",
  title: "Straight-through tests",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const WRITTEN_OUT_ANSWERS: Rule = {
  name: "written-out-answers",
  title: "Written-out answers",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [
    { kind: "principle", principle: THE_TYPE_CHECKER_PROVES_IT },
    { kind: "rule", rule: DECLARED_NOT_ASSERTED },
  ],
};

const STATES_WHAT_THE_UNIT_GIVES_BACK: Case = {
  name: "states-what-the-unit-gives-back-for-one-case-or-several",
  title: "States what the unit gives back, for one case or several",
  standing: "accepted",
  owes: [
    { kind: "principle", principle: TESTS_ARE_OURS },
    { kind: "rule", rule: STRAIGHT_THROUGH_TESTS },
  ],
};

const STUB_WITH_VIFN: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "stub-with-vi-fn",
  title: "Stub with vi.fn",
  standing: "accepted",
  reason: {
    text: "A stub states its answer, so the test reads what the unit is handed.",
    standing: "accepted",
  },
};

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    { case: GIVES_A_VALUE_ITS_TYPE, points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }] },
  ],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [
    {
      situation: "an outside contract forces the type",
      kind: AUTHORISED_LOCATION_KIND,
      binding: "check-and-file",
    },
  ],
};

const TEXT_PAST_ITS_READER: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "text-past-its-reader",
  title: "Text past its reader",
  seen: "JSON text in a test.",
  mayIndicate: [
    {
      case: STATES_WHAT_THE_UNIT_GIVES_BACK,
      points: [{ kind: "rule", rule: WRITTEN_OUT_ANSWERS }],
    },
  ],
  breachUsuallySits: "in the test",
  recipes: [],
  correctUses: [
    { situation: "one test site", kind: AUTHORISED_LOCATION_KIND, binding: "check-and-file" },
  ],
};

const BRANCH_IN_A_TEST: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "branch-in-a-test",
  title: "Branch in a test",
  seen: "An if in a test.",
  mayIndicate: [
    {
      case: STATES_WHAT_THE_UNIT_GIVES_BACK,
      points: [{ kind: "rule", rule: STRAIGHT_THROUGH_TESTS }],
    },
  ],
  breachUsuallySits: "in the test",
  recipes: [],
  correctUses: [],
};

const DOUBLE_WITH_A_BODY: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "double-with-a-body",
  title: "Double with a body",
  seen: "A fake.",
  mayIndicate: [
    {
      case: STATES_WHAT_THE_UNIT_GIVES_BACK,
      points: [{ kind: "rule", rule: WRITTEN_OUT_ANSWERS }],
    },
  ],
  breachUsuallySits: "in the test",
  recipes: [STUB_WITH_VIFN],
  correctUses: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
  page: "claimed-type/cast-expressions.md",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("cast-expressions"),
  },
  engines: [],
  forms: [],
  findingSpecifics: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
  page: "branch-in-a-test/test-body.md",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-27"),
    clause: clauseIdOf("test-body-logic"),
  },
  engines: [],
  forms: ["branching-with-if"],
  findingSpecifics: [],
};

type DebtSymptomRow = { readonly symptom: SymptomAddress; readonly file: RepoPath };

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const ACME = { name: ruleSetNameOf("acme") };

const WHY_CHAIN = {
  whys: [
    {
      why: "Why does stripe-webhook.ts cast the parsed event to Stripe.Event?",
      because:
        "The Stripe SDK hands the webhook handler an untyped payload and its constructEvent returns the event typed only through its own declaration.",
      evidence: "src/adapters/stripe-webhook.ts:12.",
    },
    {
      why: "Why does the Stripe SDK hand the handler an untyped payload?",
      because:
        "Webhook bodies arrive as raw bytes over HTTP, and the signature check must run over those exact bytes before any parsing.",
      evidence: "https://stripe.com/docs/webhooks/signatures.",
    },
    {
      why: "Why must the signature check run over the raw bytes?",
      because:
        "Stripe signs the bytes it sent, so any reformatting by a parser would change them and break verification.",
      evidence: "https://stripe.com/docs/webhooks/signatures#verify-manually.",
    },
    {
      why: "Why does Stripe sign the bytes it sent rather than a parsed form?",
      because:
        "An HMAC over the transmitted body is the only form both ends can reproduce without agreeing a canonical serialisation.",
      evidence: "RFC 2104 defines HMAC over an octet string.",
    },
    {
      why: "Why can both ends reproduce only an HMAC over the transmitted body?",
      because:
        "JSON has no canonical serialisation, so key order and whitespace differ between producers, and only the octets on the wire are shared.",
      evidence: "RFC 8259 leaves member order and whitespace to the producer.",
    },
  ],
  rootCause:
    "JSON has no canonical serialisation, so the octets on the wire are the only shared form a signature can cover.",
  rootEvidence: "On 2026-11-20, RFC 8259 still leaves member order and whitespace to the producer.",
  readback:
    "JSON has no canonical serialisation, therefore Stripe signs the raw octets, therefore the SDK hands an untyped payload, therefore stripe-webhook.ts casts the parsed event to Stripe.Event.",
  owner: "owner decision on example/payments#12",
};

const UNMEASURED: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

const DEBT_FILE = repoPathOf("hone-records/debt/text-past-its-reader.json");

const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const DEVIATIONS_FILE = repoPathOf("hone-records/deviations/stub-with-vi-fn.json");

const DEPENDENCIES_FILE = repoPathOf("hone-records/dependency-records.json");

const STATED_AUTHORISED_LOCATION = {
  answers: "claimed-type#cast-expressions",
  file: "src/adapters/stripe-webhook.ts",
  case: "gives-a-value-its-type",
  owes: "declared-not-asserted",
  whyChain: WHY_CHAIN,
};

const CARRIED_ENTRY = {
  kind: "authorised-location",
  clause: "CD-2#cast-expressions",
  file: "src/adapters/stripe-webhook.ts",
  reason: "The Stripe SDK types the event only through its declaration.",
  provenance: { kind: "existing-authorisation", source: "docs/decisions/0007-stripe.md" },
};

const CARRIED_AUTHORISED_LOCATION = {
  answers: "claimed-type#cast-expressions",
  file: "src/adapters/stripe-webhook.ts",
  carried: CARRIED_ENTRY,
};

const DEVIATION = {
  recipe: "stub-with-vi-fn",
  file: "src/sync/replay.test.ts",
  recipeReason: "A stub states its answer, so the test reads what the unit is handed.",
  reasonFails: "The replay is handed a stream whose answers depend on earlier calls.",
  evidence: "src/sync/replay.test.ts:40 calls next() four times.",
  ruleHolds: "Each answer is still written out in the fake's table.",
};

type BoundPartyRow = { readonly outsideParty: string; readonly party: OutsideParty };

type HeldEntryRow = { readonly held: HeldAs; readonly entry: ReadonlyJsonValue };

describe("recordOf, a team's records in its rule set's folder", () => {
  const TEAM_TEXT_PAST_ITS_READER: Symptom = { ...TEXT_PAST_ITS_READER, ruleSet: ACME };

  const TEAM_DEBT_FILE = repoPathOf("hone-records/acme/debt/text-past-its-reader.json");

  it("reads a team's debt as owed on the team's symptom, not Hone's of the same name", () => {
    expect(
      recordOf({
        symptoms: [TEXT_PAST_ITS_READER, TEAM_TEXT_PAST_ITS_READER],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: TEAM_DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: ACME },
        entry: { answers: "text-past-its-reader", file: "src/orders/charge-order.test.ts" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "debt",
        symptom: { ruleSet: ACME, name: "text-past-its-reader" },
        reach: WHOLE_SYMPTOM,
        file: "src/orders/charge-order.test.ts",
        holding: { held: "stated" },
      },
    });
  });

  it("refuses a team's debt on a symptom only Hone has, naming it unknown", () => {
    expect(
      recordOf({
        symptoms: [TEXT_PAST_ITS_READER],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: TEAM_DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: ACME },
        entry: { answers: "text-past-its-reader", file: "src/orders/charge-order.test.ts" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "unknown-symptom", symptom: "text-past-its-reader" }],
    });
  });
});

describe("recordOf, debt", () => {
  it("reads the plan's debt record, which states the symptom and the site and nothing more", () => {
    expect(
      recordOf({
        symptoms: [TEXT_PAST_ITS_READER],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers: "text-past-its-reader", file: "src/orders/charge-order.test.ts" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "debt",
        symptom: { ruleSet: TOOL_RULE_SET, name: "text-past-its-reader" },
        reach: WHOLE_SYMPTOM,
        file: "src/orders/charge-order.test.ts",
        holding: { held: "stated" },
      },
    });
  });

  it("keeps a debt record's optional note", () => {
    expect(
      recordOf({
        symptoms: [TEXT_PAST_ITS_READER],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: {
          answers: "text-past-its-reader",
          file: "src/orders/charge-order.test.ts",
          note: "paid with the orders rewrite",
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "debt",
        symptom: { ruleSet: TOOL_RULE_SET, name: "text-past-its-reader" },
        reach: WHOLE_SYMPTOM,
        file: "src/orders/charge-order.test.ts",
        note: "paid with the orders rewrite",
        holding: { held: "stated" },
      },
    });
  });

  it.each<DebtSymptomRow>([
    {
      symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
      file: repoPathOf("hone-records/debt/claimed-type.json"),
    },
    {
      symptom: { ruleSet: TOOL_RULE_SET, name: "text-past-its-reader" },
      file: repoPathOf("hone-records/debt/text-past-its-reader.json"),
    },
    {
      symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
      file: repoPathOf("hone-records/debt/branch-in-a-test.json"),
    },
    {
      symptom: { ruleSet: TOOL_RULE_SET, name: "double-with-a-body" },
      file: repoPathOf("hone-records/debt/double-with-a-body.json"),
    },
  ])("accepts debt on $symptom.name, since every symptom accepts debt", ({ symptom, file }) => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE, TEXT_PAST_ITS_READER, BRANCH_IN_A_TEST, DOUBLE_WITH_A_BODY],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers: symptom.name, file: "src/held.ts" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "debt",
        symptom,
        reach: WHOLE_SYMPTOM,
        file: "src/held.ts",
        holding: { held: "stated" },
      },
    });
  });

  it("refuses debt on a symptom the catalogue does not hold", () => {
    const file = repoPathOf("hone-records/debt/unheard-of.json");
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers: "unheard-of", file: "src/held.ts" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "unknown-symptom", symptom: "unheard-of" }],
    });
  });

  it("refuses debt filed under another symptom's file, naming the file it belongs in", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers: "claimed-type", file: "src/held.ts" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "misplaced", belongsIn: "hone-records/debt/claimed-type.json" }],
    });
  });

  it("refuses debt that names no site, with the form's issues as values", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers: "text-past-its-reader" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [
        {
          kind: "form-refused",
          issues: [{ path: ["file"], message: expect.any(String) }],
        },
      ],
    });
  });
});

describe("recordOf, authorised locations", () => {
  it("reads the plan's authorised location, resolving its case and the rule that case owes", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [GIVES_A_VALUE_ITS_TYPE],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: STATED_AUTHORISED_LOCATION,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "stated",
          owing: {
            matches: "the-catalogue",
            case: GIVES_A_VALUE_ITS_TYPE,
            owes: { kind: "rule", rule: DECLARED_NOT_ASSERTED },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });

  it("refuses a stated authorised location on a symptom the catalogue gives no authorised-location correct use", () => {
    expect(
      recordOf({
        symptoms: [BRANCH_IN_A_TEST],
        checks: [TEST_BODY_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/authorised-locations/branch-in-a-test.json"),
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          ...STATED_AUTHORISED_LOCATION,
          answers: "branch-in-a-test#test-body",
          case: "states-what-the-unit-gives-back-for-one-case-or-several",
          owes: "straight-through-tests",
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "no-authorised-correct-use", symptom: "branch-in-a-test" }],
    });
  });

  it("reads a carried authorised location on a symptom the catalogue gives no authorised-location correct use as bound to its check and file", () => {
    const resolved = recordOf({
      symptoms: [BRANCH_IN_A_TEST],
      checks: [TEST_BODY_CHECK],
      recipes: [],
      cases: [],
      namedBans: [],
      base: UNMEASURED,
      file: repoPathOf("hone-records/authorised-locations/branch-in-a-test.json"),
      filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
      entry: { ...CARRIED_AUTHORISED_LOCATION, answers: "branch-in-a-test#test-body" },
    });

    expect(resolved).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
        reach: {
          reaches: "one-check",
          check: {
            name: "test-body",
            symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "carried",
          entry: CARRIED_ENTRY,
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
      },
    });
  });

  it.each<HeldEntryRow>([
    { held: "stated", entry: { ...STATED_AUTHORISED_LOCATION, answers: "claimed-type" } },
    { held: "carried", entry: { ...CARRIED_AUTHORISED_LOCATION, answers: "claimed-type" } },
  ])(
    "refuses an authorised location that names its symptom and no check, as a $held record",
    ({ entry }) => {
      const resolved = recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry,
      });

      expect(resolved).toEqual({
        outcome: "failed",
        error: [{ kind: "no-check-named", symptom: "claimed-type" }],
      });
    },
  );

  it("refuses an authorised location naming an outside party on a symptom that binds none", () => {
    const resolved = recordOf({
      symptoms: [CLAIMED_TYPE],
      checks: [],
      recipes: [],
      cases: [],
      namedBans: [],
      base: UNMEASURED,
      file: AUTHORISED_FILE,
      filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
      entry: { ...STATED_AUTHORISED_LOCATION, outsideParty: "zod" },
    });

    expect(resolved).toEqual({
      outcome: "failed",
      error: [{ kind: "outside-party-not-bound", symptom: "claimed-type" }],
    });
  });

  it("accepts an authorised location naming a case the catalogue does not hold, noting the case for the report", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [GIVES_A_VALUE_ITS_TYPE],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: { ...STATED_AUTHORISED_LOCATION, case: "needs-it-here" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "stated",
          owing: {
            matches: "not-the-catalogue",
            note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });

  it("accepts an authorised location whose owes is not a rule or principle its case owes, noting the owes for the report", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [GIVES_A_VALUE_ITS_TYPE],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: { ...STATED_AUTHORISED_LOCATION, owes: "written-out-answers" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "stated",
          owing: {
            matches: "not-the-catalogue",
            note: {
              kind: "owes-not-owed",
              case: GIVES_A_VALUE_ITS_TYPE,
              owes: "written-out-answers",
            },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });

  it.each([
    {
      written: { case: "No Such Case" },
      note: { kind: "unknown-case", case: "No Such Case", owes: "declared-not-asserted" },
    },
    {
      written: { owes: "Declared, not asserted" },
      note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "Declared, not asserted" },
    },
  ])(
    "accepts an authorised location whose case or owes is spelt $written, noting it however it is spelt",
    ({ written, note }) => {
      expect(
        recordOf({
          symptoms: [CLAIMED_TYPE],
          checks: [CAST_CHECK],
          recipes: [],
          cases: [GIVES_A_VALUE_ITS_TYPE],
          namedBans: [],
          base: UNMEASURED,
          file: AUTHORISED_FILE,
          filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
          entry: { ...STATED_AUTHORISED_LOCATION, ...written },
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          kind: "authorised-location",
          symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          reach: {
            reaches: "one-check",
            check: {
              name: "cast-expressions",
              symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
            },
          },
          file: "src/adapters/stripe-webhook.ts",
          holding: {
            binding: { binds: "check-and-file" },
            held: "stated",
            owing: { matches: "not-the-catalogue", note },
            whyChain: WHY_CHAIN,
          },
        },
      });
    },
  );

  it("OPEN TABLE, hone#206: accepts Text past its reader at one test site owing Written-out answers, which its indication points at but its case does not owe, with the note", () => {
    expect(
      recordOf({
        symptoms: [TEXT_PAST_ITS_READER],
        checks: [],
        recipes: [],
        cases: [STATES_WHAT_THE_UNIT_GIVES_BACK],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/authorised-locations/text-past-its-reader.json"),
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          ...STATED_AUTHORISED_LOCATION,
          answers: "text-past-its-reader#json-parse",
          file: "src/orders/charge-order.test.ts",
          case: "states-what-the-unit-gives-back-for-one-case-or-several",
          owes: "written-out-answers",
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "text-past-its-reader" },
        reach: { reaches: "unknown-check", check: "json-parse" },
        file: "src/orders/charge-order.test.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "stated",
          owing: {
            matches: "not-the-catalogue",
            note: {
              kind: "owes-not-owed",
              case: STATES_WHAT_THE_UNIT_GIVES_BACK,
              owes: "written-out-answers",
            },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });

  it("refuses an authorised location whose why-chain does not hold, with the chain's issues as values", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          ...STATED_AUTHORISED_LOCATION,
          whyChain: { ...WHY_CHAIN, readback: "It is needed here." },
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: [
        {
          kind: "form-refused",
          issues: expect.arrayContaining([
            expect.objectContaining({ path: ["whyChain", "readback"] }),
          ]),
        },
      ],
    });
  });
});

describe("recordOf, a record naming one check of its symptom", () => {
  const DEBT_ON_CLAIMED_TYPE_FILE = repoPathOf("hone-records/debt/claimed-type.json");

  it("reads a counted debt on <symptom>#<check> in its symptom's file", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_ON_CLAIMED_TYPE_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: {
          answers: "claimed-type#cast-expressions",
          file: "src/adapters/stripe-webhook.ts",
          findings: 2,
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "debt",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        findings: 2,
        holding: { held: "stated" },
      },
    });
  });

  it("reads an authorised location on <symptom>#<check> as reaching that check, filed in its symptom's file", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [GIVES_A_VALUE_ITS_TYPE],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: { ...STATED_AUTHORISED_LOCATION, answers: "claimed-type#cast-expressions" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "stated",
          owing: {
            matches: "the-catalogue",
            case: GIVES_A_VALUE_ITS_TYPE,
            owes: { kind: "rule", rule: DECLARED_NOT_ASSERTED },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });

  it("reads a carried authorised location on <symptom>#<check> as reaching that check", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: { ...CARRIED_AUTHORISED_LOCATION, answers: "claimed-type#cast-expressions" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "carried",
          entry: CARRIED_ENTRY,
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
      },
    });
  });

  it.each([
    {
      name: "a check the catalogue does not hold",
      answers: "claimed-type#non-null-assertions",
      check: "non-null-assertions",
    },
    { name: "another symptom's check", answers: "claimed-type#test-body", check: "test-body" },
  ])("refuses debt naming $name for its symptom", ({ answers, check }) => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK, TEST_BODY_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_ON_CLAIMED_TYPE_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers, file: "src/adapters/stripe-webhook.ts" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "unknown-check", symptom: "claimed-type", check }],
    });
  });

  it("accepts an authorised location naming a check its symptom does not have, reaching that unknown check and no other", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [GIVES_A_VALUE_ITS_TYPE],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: { ...STATED_AUTHORISED_LOCATION, answers: "claimed-type#non-null-assertions" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: { reaches: "unknown-check", check: "non-null-assertions" },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "stated",
          owing: {
            matches: "the-catalogue",
            case: GIVES_A_VALUE_ITS_TYPE,
            owes: { kind: "rule", rule: DECLARED_NOT_ASSERTED },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });

  it("accepts a carried authorised location naming another symptom's check, reaching that unknown check and no other", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [TEST_BODY_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: { ...CARRIED_AUTHORISED_LOCATION, answers: "claimed-type#test-body" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: { reaches: "unknown-check", check: "test-body" },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "carried",
          entry: CARRIED_ENTRY,
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
      },
    });
  });

  it("refuses debt naming a check filed in another symptom's file, naming its symptom's file", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers: "claimed-type#cast-expressions", file: "src/adapters/stripe-webhook.ts" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "misplaced", belongsIn: "hone-records/debt/claimed-type.json" }],
    });
  });

  it("refuses debt naming a check of a symptom the catalogue does not hold by its symptom alone", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/debt/unheard-of.json"),
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers: "unheard-of#cast-expressions", file: "src/held.ts" },
      }),
    ).toEqual({ outcome: "failed", error: [{ kind: "unknown-symptom", symptom: "unheard-of" }] });
  });
});

describe("owedBy", () => {
  it("finds a rule the case owes", () => {
    expect(
      owedBy({
        cases: [GIVES_A_VALUE_ITS_TYPE],
        case: "gives-a-value-its-type",
        owes: "declared-not-asserted",
      }),
    ).toEqual({
      matches: "the-catalogue",
      case: GIVES_A_VALUE_ITS_TYPE,
      owes: { kind: "rule", rule: DECLARED_NOT_ASSERTED },
    });
  });

  it("finds a principle the case owes", () => {
    expect(
      owedBy({
        cases: [GIVES_A_VALUE_ITS_TYPE],
        case: "gives-a-value-its-type",
        owes: "the-type-checker-proves-it",
      }),
    ).toEqual({
      matches: "the-catalogue",
      case: GIVES_A_VALUE_ITS_TYPE,
      owes: { kind: "principle", principle: THE_TYPE_CHECKER_PROVES_IT },
    });
  });

  it("notes a rule that a symptom's indication points at but the case does not owe", () => {
    expect(
      owedBy({
        cases: [STATES_WHAT_THE_UNIT_GIVES_BACK],
        case: "states-what-the-unit-gives-back-for-one-case-or-several",
        owes: "written-out-answers",
      }),
    ).toEqual({
      matches: "not-the-catalogue",
      note: {
        kind: "owes-not-owed",
        case: STATES_WHAT_THE_UNIT_GIVES_BACK,
        owes: "written-out-answers",
      },
    });
  });

  it("notes a case the catalogue does not hold", () => {
    expect(
      owedBy({
        cases: [GIVES_A_VALUE_ITS_TYPE],
        case: "needs-it-here",
        owes: "declared-not-asserted",
      }),
    ).toEqual({
      matches: "not-the-catalogue",
      note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" },
    });
  });
});

describe("recordOf, carried records", () => {
  it("lists a carried authorised location with what it lacks, unjudged when the base revision is not measured", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: CARRIED_AUTHORISED_LOCATION,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "carried",
          entry: CARRIED_ENTRY,
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
      },
    });
  });

  it("holds a carried record established when the base revision holds it word for word", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: {
          measured: "yes",
          documents: [
            {
              file: AUTHORISED_FILE,
              document: { version: 2, records: [CARRIED_AUTHORISED_LOCATION] },
            },
          ],
        },
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: CARRIED_AUTHORISED_LOCATION,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "carried",
          entry: CARRIED_ENTRY,
          lacks: ["case", "owes", "whyChain"],
          standing: "established",
        },
      },
    });
  });

  it("refuses a carried record whose words changed since the base revision", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: {
          measured: "yes",
          documents: [
            {
              file: AUTHORISED_FILE,
              document: { version: 2, records: [CARRIED_AUTHORISED_LOCATION] },
            },
          ],
        },
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          ...CARRIED_AUTHORISED_LOCATION,
          carried: { ...CARRIED_ENTRY, reason: "Reworded." },
        },
      }),
    ).toEqual({ outcome: "failed", error: [{ kind: "carried-changed-since-base" }] });
  });

  it("holds a carried debt record as lacking nothing", () => {
    const entry = {
      kind: "file-carve-out",
      clause: "CD-27#test-body-logic",
      file: "src/orders/charge-order.test.ts",
      provenance: { kind: "inherited-debt", source: "legacy.json", decision: "#3" },
    };
    expect(
      recordOf({
        symptoms: [TEXT_PAST_ITS_READER],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: {
          answers: "text-past-its-reader",
          file: "src/orders/charge-order.test.ts",
          carried: entry,
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "debt",
        symptom: { ruleSet: TOOL_RULE_SET, name: "text-past-its-reader" },
        reach: WHOLE_SYMPTOM,
        file: "src/orders/charge-order.test.ts",
        holding: { held: "carried", entry, lacks: [], standing: "unjudged" },
      },
    });
  });
});

describe("recordOf, an authorised location's outside party", () => {
  it.each<BoundPartyRow>([
    { outsideParty: "zod", party: { kind: "package", dependency: "zod" } },
    { outsideParty: "@scope/pkg", party: { kind: "package", dependency: "@scope/pkg" } },
    { outsideParty: "node:fs", party: { kind: "scheme-module", specifier: "node:fs" } },
  ])("reads a stated record bound to $outsideParty", ({ outsideParty, party }) => {
    const outsideImportPastABoundary: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION_KIND,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const importCheck: Check = {
      name: "import-or-require",
      symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      engines: [],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    expect(
      recordOf({
        symptoms: [outsideImportPastABoundary],
        checks: [importCheck],
        recipes: [],
        cases: [GIVES_A_VALUE_ITS_TYPE],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/authorised-locations/outside-import-past-a-boundary.json"),
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          ...STATED_AUTHORISED_LOCATION,
          answers: "outside-import-past-a-boundary#import-or-require",
          outsideParty,
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
        reach: {
          reaches: "one-check",
          check: {
            name: "import-or-require",
            symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: { binds: "check-file-and-outside-party", outsideParty: party },
          held: "stated",
          owing: {
            matches: "the-catalogue",
            case: GIVES_A_VALUE_ITS_TYPE,
            owes: { kind: "rule", rule: DECLARED_NOT_ASSERTED },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });

  it("reads a carried record bound to a whole scheme", () => {
    const outsideImportPastABoundary: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION_KIND,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const importCheck: Check = {
      name: "import-or-require",
      symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      engines: [],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    expect(
      recordOf({
        symptoms: [outsideImportPastABoundary],
        checks: [importCheck],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/authorised-locations/outside-import-past-a-boundary.json"),
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          ...CARRIED_AUTHORISED_LOCATION,
          answers: "outside-import-past-a-boundary#import-or-require",
          outsideParty: "node:",
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
        reach: {
          reaches: "one-check",
          check: {
            name: "import-or-require",
            symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
          },
        },
        file: "src/adapters/stripe-webhook.ts",
        holding: {
          binding: {
            binds: "check-file-and-outside-party",
            outsideParty: { kind: "scheme", scheme: "node:" },
          },
          held: "carried",
          entry: CARRIED_ENTRY,
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
      },
    });
  });

  it("refuses a stated record bound to a whole scheme", () => {
    const outsideImportPastABoundary: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION_KIND,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const importCheck: Check = {
      name: "import-or-require",
      symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      engines: [],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    expect(
      recordOf({
        symptoms: [outsideImportPastABoundary],
        checks: [importCheck],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/authorised-locations/outside-import-past-a-boundary.json"),
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          ...STATED_AUTHORISED_LOCATION,
          answers: "outside-import-past-a-boundary#import-or-require",
          outsideParty: "node:",
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "scheme-party-stated", outsideParty: "node:" }],
    });
  });

  it.each<HeldEntryRow>([
    {
      held: "stated",
      entry: {
        ...STATED_AUTHORISED_LOCATION,
        answers: "outside-import-past-a-boundary#import-or-require",
      },
    },
    {
      held: "carried",
      entry: {
        ...CARRIED_AUTHORISED_LOCATION,
        answers: "outside-import-past-a-boundary#import-or-require",
      },
    },
  ])(
    "refuses a record that names no outside party on a symptom that binds one, as a $held record",
    ({ entry }) => {
      const outsideImportPastABoundary: Symptom = {
        ruleSet: TOOL_RULE_SET,
        name: "outside-import-past-a-boundary",
        title: "Outside import past a boundary",
        seen: "A package imported outside its adapter.",
        mayIndicate: [],
        breachUsuallySits: "in the importing file",
        recipes: [],
        correctUses: [
          {
            situation: "the adapter for that outside party",
            kind: AUTHORISED_LOCATION_KIND,
            binding: "check-file-and-outside-party",
          },
        ],
      };
      const importCheck: Check = {
        name: "import-or-require",
        symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
        page: "outside-import-past-a-boundary/import-or-require.md",
        engines: [],
        forms: [],
        findingSpecifics: ["outside-party"],
      };
      const resolved = recordOf({
        symptoms: [outsideImportPastABoundary],
        checks: [importCheck],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/authorised-locations/outside-import-past-a-boundary.json"),
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry,
      });

      expect(resolved).toEqual({
        outcome: "failed",
        error: [{ kind: "outside-party-missing", symptom: "outside-import-past-a-boundary" }],
      });
    },
  );

  it("refuses an outside party that is no package, module or scheme", () => {
    const outsideImportPastABoundary: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION_KIND,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const importCheck: Check = {
      name: "import-or-require",
      symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      engines: [],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    expect(
      recordOf({
        symptoms: [outsideImportPastABoundary],
        checks: [importCheck],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/authorised-locations/outside-import-past-a-boundary.json"),
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          ...STATED_AUTHORISED_LOCATION,
          answers: "outside-import-past-a-boundary#import-or-require",
          outsideParty: "Not A Package",
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: [
        { kind: "form-refused", issues: [expect.objectContaining({ path: ["outsideParty"] })] },
      ],
    });
  });

  it("reads Hone's own record on git-port.test.ts as bound to its check and file", () => {
    const nameOffItsCasing: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "name-off-its-casing",
      title: "Name off its casing",
      seen: "A name in another casing.",
      mayIndicate: [],
      breachUsuallySits: "in the unit",
      recipes: [],
      correctUses: [
        {
          situation: "an outside contract names it",
          kind: AUTHORISED_LOCATION_KIND,
          binding: "check-and-file",
        },
      ],
    };
    const namingCheck: Check = {
      name: "naming-convention",
      symptom: { ruleSet: TOOL_RULE_SET, name: "name-off-its-casing" },
      page: "name-off-its-casing/naming-convention.md",
      engines: [],
      forms: [],
      findingSpecifics: [],
    };
    expect(
      recordOf({
        symptoms: [nameOffItsCasing],
        checks: [namingCheck],
        recipes: [],
        cases: [GIVES_A_VALUE_ITS_TYPE],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/authorised-locations/name-off-its-casing.json"),
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: {
          answers: "name-off-its-casing#naming-convention",
          file: "src/infrastructure/git/git-port.test.ts",
          case: "gives-a-value-its-type",
          owes: "declared-not-asserted",
          whyChain: WHY_CHAIN,
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "name-off-its-casing" },
        reach: {
          reaches: "one-check",
          check: {
            name: "naming-convention",
            symptom: { ruleSet: TOOL_RULE_SET, name: "name-off-its-casing" },
          },
        },
        file: "src/infrastructure/git/git-port.test.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "stated",
          owing: {
            matches: "the-catalogue",
            case: GIVES_A_VALUE_ITS_TYPE,
            owes: { kind: "rule", rule: DECLARED_NOT_ASSERTED },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });
});

describe("recordOf, a record's own text never stops the reader", () => {
  it.each([
    { answers: "/x" },
    { answers: "../claimed-type" },
    { answers: "claimed type" },
    { answers: "Claimed-Type" },
  ])("refuses debt whose address is written $answers as a form refusal", ({ answers }) => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEBT_FILE,
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers, file: "src/held.ts" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "form-refused", issues: [expect.objectContaining({ path: ["answers"] })] }],
    });
  });

  it("refuses a deviation whose recipe holds a line break as a form refusal", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEVIATIONS_FILE,
        filedUnder: { kind: "deviations", ruleSet: TOOL_RULE_SET },
        entry: { ...DEVIATION, recipe: "stub-with-vi-fn\n" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "form-refused", issues: [expect.objectContaining({ path: ["recipe"] })] }],
    });
  });
});

describe("recordOf, deviations", () => {
  it("reads the plan's deviation, whose recipe reason is the catalogue's sentence exactly", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [STUB_WITH_VIFN],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEVIATIONS_FILE,
        filedUnder: { kind: "deviations", ruleSet: TOOL_RULE_SET },
        entry: DEVIATION,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "deviation",
        recipe: STUB_WITH_VIFN,
        file: "src/sync/replay.test.ts",
        reasonFails: "The replay is handed a stream whose answers depend on earlier calls.",
        evidence: "src/sync/replay.test.ts:40 calls next() four times.",
        ruleHolds: "Each answer is still written out in the fake's table.",
      },
    });
  });

  it("reads a team's deviation as from the team's recipe, not Hone's of the same name", () => {
    const teamRecipe: Recipe = { ...STUB_WITH_VIFN, ruleSet: ACME };
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [STUB_WITH_VIFN, teamRecipe],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/acme/deviations/stub-with-vi-fn.json"),
        filedUnder: { kind: "deviations", ruleSet: ACME },
        entry: DEVIATION,
      }),
    ).toMatchObject({ outcome: "ok", value: { kind: "deviation", recipe: teamRecipe } });
  });

  it("refuses a team's deviation from a recipe only Hone has", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [STUB_WITH_VIFN],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/acme/deviations/stub-with-vi-fn.json"),
        filedUnder: { kind: "deviations", ruleSet: ACME },
        entry: DEVIATION,
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "unknown-recipe", recipe: "acme/stub-with-vi-fn" }],
    });
  });

  it("refuses a deviation whose recipe reason is not the catalogue's sentence", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [STUB_WITH_VIFN],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: DEVIATIONS_FILE,
        filedUnder: { kind: "deviations", ruleSet: TOOL_RULE_SET },
        entry: { ...DEVIATION, recipeReason: "Stubs are simpler." },
      }),
    ).toEqual({
      outcome: "failed",
      error: [
        {
          kind: "recipe-reason-not-the-catalogues",
          recipe: STUB_WITH_VIFN,
          recipeReason: "Stubs are simpler.",
        },
      ],
    });
  });

  it("refuses a deviation from a recipe the catalogue does not hold", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [STUB_WITH_VIFN],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/deviations/hand-rolled-fakes.json"),
        filedUnder: { kind: "deviations", ruleSet: TOOL_RULE_SET },
        entry: { ...DEVIATION, recipe: "hand-rolled-fakes" },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "unknown-recipe", recipe: "hand-rolled-fakes" }],
    });
  });

  it("refuses a deviation filed under another recipe's file", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [STUB_WITH_VIFN],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
        file: repoPathOf("hone-records/deviations/whole-written-out-expectation.json"),
        filedUnder: { kind: "deviations", ruleSet: TOOL_RULE_SET },
        entry: DEVIATION,
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "misplaced", belongsIn: "hone-records/deviations/stub-with-vi-fn.json" }],
    });
  });
});

describe("recordOf, dependency records", () => {
  it("reads the plan's dependency record", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [{ outsideDependency: "lodash" }],
        base: UNMEASURED,
        file: DEPENDENCIES_FILE,
        filedUnder: { kind: "dependency-records" },
        entry: {
          dependency: "zod",
          nativeWay: "hand-written parsing at each adapter",
          whyNotEnough: "Each adapter would repeat its own checks.",
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "dependency-record",
        dependency: "zod",
        nativeWay: "hand-written parsing at each adapter",
        whyNotEnough: "Each adapter would repeat its own checks.",
      },
    });
  });

  it("keeps a peer dependency's risk to whoever runs it", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [{ outsideDependency: "lodash" }],
        base: UNMEASURED,
        file: DEPENDENCIES_FILE,
        filedUnder: { kind: "dependency-records" },
        entry: {
          dependency: "eslint",
          nativeWay: "a walker of our own",
          whyNotEnough: "Teams already lint.",
          peerRisk: "A team on an older ESLint line gets a load failure.",
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "dependency-record",
        dependency: "eslint",
        nativeWay: "a walker of our own",
        whyNotEnough: "Teams already lint.",
        peerRisk: "A team on an older ESLint line gets a load failure.",
      },
    });
  });

  it("refuses a dependency record that would make a named ban correct", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [{ outsideDependency: "lodash" }],
        base: UNMEASURED,
        file: DEPENDENCIES_FILE,
        filedUnder: { kind: "dependency-records" },
        entry: {
          dependency: "lodash",
          nativeWay: "Array methods",
          whyNotEnough: "groupBy was missing.",
        },
      }),
    ).toEqual({ outcome: "failed", error: [{ kind: "named-ban", dependency: "lodash" }] });
  });

  it.each([{ dependency: "Lodash" }, { dependency: "LODASH" }])(
    "refuses a dependency record on $dependency, since a ban is not beaten by case",
    ({ dependency }) => {
      expect(
        recordOf({
          symptoms: [],
          checks: [],
          recipes: [],
          cases: [],
          namedBans: [{ outsideDependency: "lodash" }],
          base: UNMEASURED,
          file: DEPENDENCIES_FILE,
          filedUnder: { kind: "dependency-records" },
          entry: { dependency, nativeWay: "Array methods", whyNotEnough: "groupBy was missing." },
        }),
      ).toEqual({ outcome: "failed", error: [{ kind: "named-ban", dependency }] });
    },
  );

  it("reads a dependency record on a legacy package name with capitals", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [{ outsideDependency: "lodash" }],
        base: UNMEASURED,
        file: DEPENDENCIES_FILE,
        filedUnder: { kind: "dependency-records" },
        entry: {
          dependency: "JSONStream",
          nativeWay: "a hand-written stream parser",
          whyNotEnough: "The payload is too large to hold.",
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "dependency-record",
        dependency: "JSONStream",
        nativeWay: "a hand-written stream parser",
        whyNotEnough: "The payload is too large to hold.",
      },
    });
  });

  it.each([
    { dependency: "lodash " },
    { dependency: " lodash" },
    { dependency: "lodash/fp" },
    { dependency: "npm:lodash" },
  ])(
    "refuses a dependency written $dependency, which is not the name of one direct outside dependency",
    ({ dependency }) => {
      expect(
        recordOf({
          symptoms: [],
          checks: [],
          recipes: [],
          cases: [],
          namedBans: [{ outsideDependency: "lodash" }],
          base: UNMEASURED,
          file: DEPENDENCIES_FILE,
          filedUnder: { kind: "dependency-records" },
          entry: { dependency, nativeWay: "Array methods", whyNotEnough: "groupBy was missing." },
        }),
      ).toEqual({
        outcome: "failed",
        error: [
          { kind: "form-refused", issues: [expect.objectContaining({ path: ["dependency"] })] },
        ],
      });
    },
  );

  it("reads a scoped dependency by its full name", () => {
    expect(
      recordOf({
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [{ outsideDependency: "lodash" }],
        base: UNMEASURED,
        file: DEPENDENCIES_FILE,
        filedUnder: { kind: "dependency-records" },
        entry: {
          dependency: "@typescript-eslint/parser",
          nativeWay: "TypeScript's own parser",
          whyNotEnough: "ESLint reads only an ESTree.",
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "dependency-record",
        dependency: "@typescript-eslint/parser",
        nativeWay: "TypeScript's own parser",
        whyNotEnough: "ESLint reads only an ESTree.",
      },
    });
  });
});

describe("recordOf, a named ban refuses no debt and no authorised location", () => {
  it("accepts debt at a site that uses a named ban", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [{ outsideDependency: "lodash" }],
        base: UNMEASURED,
        file: repoPathOf("hone-records/debt/claimed-type.json"),
        filedUnder: { kind: "debt", ruleSet: TOOL_RULE_SET },
        entry: { answers: "claimed-type", file: "src/collections/lodash-grouping.ts" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "debt",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: WHOLE_SYMPTOM,
        file: "src/collections/lodash-grouping.ts",
        holding: { held: "stated" },
      },
    });
  });

  it("accepts an authorised location at a site that uses a named ban", () => {
    expect(
      recordOf({
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [GIVES_A_VALUE_ITS_TYPE],
        namedBans: [{ outsideDependency: "lodash" }],
        base: UNMEASURED,
        file: AUTHORISED_FILE,
        filedUnder: { kind: "authorised-locations", ruleSet: TOOL_RULE_SET },
        entry: { ...STATED_AUTHORISED_LOCATION, file: "src/collections/lodash-grouping.ts" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "authorised-location",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: {
          reaches: "one-check",
          check: {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
          },
        },
        file: "src/collections/lodash-grouping.ts",
        holding: {
          binding: { binds: "check-and-file" },
          held: "stated",
          owing: {
            matches: "the-catalogue",
            case: GIVES_A_VALUE_ITS_TYPE,
            owes: { kind: "rule", rule: DECLARED_NOT_ASSERTED },
          },
          whyChain: WHY_CHAIN,
        },
      },
    });
  });
});

import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { PlacedRecord, SymptomReach } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import type { WhyChain } from "../../../infrastructure/hone-records-folder/why-chain.ts";
import type { Case, Pointed, Principle, Recipe, RecordKind, Rule, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { prunableDebtOf } from "./prunable-debt.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = { name: "external-behaviour-sits-at-a-boundary", title: "External behaviour sits at a boundary" };

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const PORTS_DECLARED_INSIDE: Rule = { name: "ports-declared-inside", title: "Ports declared inside", principle: AT_A_BOUNDARY, standing: "accepted" };

const WRITTEN_OUT_ANSWERS: Rule = { name: "written-out-answers", title: "Written-out answers", principle: TESTS_ARE_OURS, standing: "accepted" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const DECLARED_NOT_ASSERTED: Rule = { name: "declared-not-asserted", title: "Declared, not asserted", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = { name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }] };

const OWED_DECLARED_NOT_ASSERTED: Pointed = { kind: "rule", rule: DECLARED_NOT_ASSERTED };

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [OWED_DECLARED_NOT_ASSERTED],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const BOUNDARY_RECORD: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

const AUTHORISED_LOCATION_KIND: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DATE_USED_DIRECTLY: Symptom = {
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of `Date` outside the places that handle dates.",
  mayIndicate: [
    {
      case: NEEDS_THE_CURRENT_TIME,
      points: [
        { kind: "rule", rule: PORTS_DECLARED_INSIDE },
        { kind: "rule", rule: WRITTEN_OUT_ANSWERS },
      ],
    },
    { case: DOES_ONE_JOB, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit that should be passed the time, often a doer doing two jobs",
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD, at: "on the clock adapter" }],
};

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [{ case: GIVES_A_VALUE_ITS_TYPE, situation: "or needs it narrower", points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }] }],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION_KIND }],
};

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const DATE_DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/date-used-directly.json"), index: 0 },
  record: { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: WHOLE_SYMPTOM, file: ORDER_FILE, holding: { held: "stated" } },
};

const CLAIMED_TYPE_DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: ORDER_FILE, holding: { held: "stated" } },
};

const AUTHORISED_LOCATION_PLACED: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: ORDER_FILE,
    holding: { held: "stated", owing: { matches: "the-catalogue", case: GIVES_A_VALUE_ITS_TYPE, owes: OWED_DECLARED_NOT_ASSERTED }, whyChain: CAUSAL_WHY_CHAIN },
  },
};

const DEPENDENCY_PLACED: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/dependency-records.json"), index: 0 },
  record: { kind: "dependency-record", dependency: "zod", nativeWay: "hand-written parsing", whyNotEnough: "it repeats at each adapter" },
};

describe("the records prune-debt removes: those the version 2 report says to run it for", () => {
  it("removes paid debt, stale debt and forfeited debt, and says which each was", () => {
    expect(
      prunableDebtOf({
        report: { paid: [{ debt: DATE_DEBT, answeredBy: [AUTHORISED_LOCATION_PLACED] }], stale: [{ placed: CLAIMED_TYPE_DEBT, reason: "credited-nothing" }], forfeited: [] },
      }),
    ).toEqual([
      { place: CLAIMED_TYPE_DEBT.place, debt: CLAIMED_TYPE_DEBT.record, reason: "credited-nothing" },
      { place: DATE_DEBT.place, debt: DATE_DEBT.record, reason: "paid" },
    ]);
  });

  it("removes forfeited debt", () => {
    expect(prunableDebtOf({ report: { paid: [], stale: [], forfeited: [DATE_DEBT] } })).toEqual([{ place: DATE_DEBT.place, debt: DATE_DEBT.record, reason: "forfeited" }]);
  });

  it("leaves every record that is not debt, since its line does not say to run prune-debt", () => {
    expect(prunableDebtOf({ report: { paid: [], stale: [{ placed: AUTHORISED_LOCATION_PLACED, reason: "credited-nothing" }, { placed: DEPENDENCY_PLACED, reason: "credited-nothing" }], forfeited: [AUTHORISED_LOCATION_PLACED] } })).toEqual([]);
  });

  it("removes nothing when the report lists nothing", () => {
    expect(prunableDebtOf({ report: { paid: [], stale: [], forfeited: [] } })).toEqual([]);
  });
});

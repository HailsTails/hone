import { describe, expect, it } from "vitest";
import { type DebtEffectsRequest, debtOutcomesOf } from "./debt-effects.ts";
import type { PlacedRecord, SymptomReach } from "../hone-records/hone-record.ts";
import type { Case, Check, Engine, Pointed, Principle, Recipe, RecordKind, Rule, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

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

const CLOCK_CHECK: Check = {
  name: "clock-sources",
  symptom: DATE_USED_DIRECTLY,
  clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-17"), clause: clauseIdOf("clock-sources") },
  engines: [WALKER],
  forms: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") },
  engines: [ESLINT_ENGINE],
  forms: [],
};

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const NEW_FILE = repoPathOf("src/orders/refund-order.ts");

const TOUCHED_FILE = repoPathOf("src/orders/edited-order.ts");

const LEFT_FOLDER = repoPathOf("src/legacy");

const LEFT_FILE = repoPathOf("src/legacy/old-order.ts");

const DEBT_FILE = repoPathOf("hone-records/debt/date-used-directly.json");

const CLOCK_ADDRESS = "date-used-directly#clock-sources";

const HELD_CLOCK_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 0 },
  record: { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: { reaches: "one-check", check: CLOCK_CHECK }, file: ORDER_FILE, holding: { held: "stated" } },
};

const HELD_WHOLE_SYMPTOM_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 1 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: ORDER_FILE, holding: { held: "stated" } },
};

const HELD_CAST_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 2 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: { reaches: "one-check", check: CAST_CHECK }, file: ORDER_FILE, holding: { held: "stated" } },
};

const REQUEST: DebtEffectsRequest = {
  sites: [{ address: CLOCK_ADDRESS, file: ORDER_FILE, origin: "finding" }],
  unrecordable: [],
  records: [],
  leave: [],
  touched: { measured: "yes", paths: new Set([TOUCHED_FILE, NEW_FILE]) },
};

describe("what record-debt does with each symptom and file the check finds", () => {
  it("records debt on a file this change left alone", () => {
    expect(debtOutcomesOf(REQUEST)).toEqual([{ address: CLOCK_ADDRESS, file: ORDER_FILE, effect: "recorded" }]);
  });

  it("writes nothing for debt already held on the same symptom, check and file, and says where it sits", () => {
    expect(debtOutcomesOf({ ...REQUEST, records: [HELD_CLOCK_DEBT] })).toEqual([{ address: CLOCK_ADDRESS, file: ORDER_FILE, effect: "already-recorded", heldIn: DEBT_FILE }]);
  });

  it("holds a whole-symptom debt to its symptom and a one-check debt to its check", () => {
    expect(
      debtOutcomesOf({
        ...REQUEST,
        sites: [
          { address: "claimed-type", file: ORDER_FILE, origin: "finding" },
          { address: "claimed-type#cast-expressions", file: ORDER_FILE, origin: "finding" },
        ],
        records: [HELD_WHOLE_SYMPTOM_DEBT],
      }),
    ).toEqual([
      { address: "claimed-type", file: ORDER_FILE, effect: "already-recorded", heldIn: DEBT_FILE },
      { address: "claimed-type#cast-expressions", file: ORDER_FILE, effect: "recorded" },
    ]);
  });

  it("does not take another file's debt, or another check's, for this one", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: "claimed-type#cast-expressions", file: LEFT_FILE, origin: "finding" }], records: [HELD_CAST_DEBT] })).toEqual([
      { address: "claimed-type#cast-expressions", file: LEFT_FILE, effect: "recorded" },
    ]);
  });

  it("leaves a file under a --leave path, naming the path", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: LEFT_FILE, origin: "finding" }], leave: [LEFT_FOLDER] })).toEqual([
      { address: CLOCK_ADDRESS, file: LEFT_FILE, effect: "left", under: LEFT_FOLDER },
    ]);
  });

  it("leaves a file that is exactly a --leave path", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: ORDER_FILE, origin: "finding" }], leave: [ORDER_FILE] })).toEqual([
      { address: CLOCK_ADDRESS, file: ORDER_FILE, effect: "left", under: ORDER_FILE },
    ]);
  });

  it("does not record debt on a file this change changed, since the run would forfeit it", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: TOUCHED_FILE, origin: "finding" }] })).toEqual([{ address: CLOCK_ADDRESS, file: TOUCHED_FILE, effect: "touched", of: "finding" }]);
  });

  it("does not record debt on a file this change created, since the run would forfeit it", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: NEW_FILE, origin: "finding" }] })).toEqual([{ address: CLOCK_ADDRESS, file: NEW_FILE, effect: "touched", of: "finding" }]);
  });

  it("says a touched file's debt came from a native exception when no finding stands there", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: TOUCHED_FILE, origin: "native-exception" }] })).toEqual([
      { address: CLOCK_ADDRESS, file: TOUCHED_FILE, effect: "touched", of: "native-exception" },
    ]);
  });

  it("records debt on a file this change changed when another run assesses forfeiture", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: TOUCHED_FILE, origin: "finding" }], touched: { measured: "elsewhere" } })).toEqual([
      { address: CLOCK_ADDRESS, file: TOUCHED_FILE, effect: "recorded" },
    ]);
  });

  it("gives a finding no debt can be written for its own line, ordered by file with the rest", () => {
    expect(debtOutcomesOf({ ...REQUEST, unrecordable: [{ address: "CD-99#nowhere", file: LEFT_FILE, because: { kind: "no-check" } }, { address: "CD-98#nowhere", file: ORDER_FILE, because: { kind: "no-check" } }] })).toEqual([
      { address: "CD-99#nowhere", file: LEFT_FILE, effect: "unrecordable", because: { kind: "no-check" } },
      { address: "CD-98#nowhere", file: ORDER_FILE, effect: "unrecordable", because: { kind: "no-check" } },
      { address: CLOCK_ADDRESS, file: ORDER_FILE, effect: "recorded" },
    ]);
  });
});

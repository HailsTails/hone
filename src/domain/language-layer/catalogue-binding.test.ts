import { describe, expect, it } from "vitest";
import { catalogueBoundTo, type EngineBindings, holdingBoundTo } from "./catalogue-binding.ts";
import type { CatalogueContent, CheckContent, Engine, RecordKind, Symptom } from "./symptom-catalogue.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";

const WALKER: Engine = { name: "walker" };

const ESLINT: Engine = { name: "eslint" };

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DATE_USED_DIRECTLY: Symptom = {
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of Date.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CLOCK_SOURCES = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-17"), clause: clauseIdOf("clock-sources") };

const LOOPS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") };

const CLOCK_SOURCES_CHECK: CheckContent = { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, forms: [] };

const LOOPS_CHECK: CheckContent = { name: "loops", symptom: DATE_USED_DIRECTLY, clause: LOOPS, forms: [] };

const CONTENT: CatalogueContent = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [DEBT, AUTHORISED_LOCATION],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [WALKER, ESLINT],
  symptoms: [DATE_USED_DIRECTLY],
  clauses: [],
  checks: [CLOCK_SOURCES_CHECK, LOOPS_CHECK],
  namedBans: [],
};

const BINDINGS: EngineBindings = new Map([
  ["date-used-directly#clock-sources", [WALKER]],
  ["date-used-directly#loops", [WALKER, ESLINT]],
]);

describe("catalogueBoundTo", () => {
  it("gives each check the engines of the pieces that run its clause", () => {
    expect(catalogueBoundTo({ content: CONTENT, bindings: BINDINGS })).toEqual({
      outcome: "ok",
      value: {
        ...CONTENT,
        checks: [
          { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, forms: [], engines: [WALKER] },
          { name: "loops", symptom: DATE_USED_DIRECTLY, clause: LOOPS, forms: [], engines: [WALKER, ESLINT] },
        ],
      },
    });
  });

  it("binds two check addresses that share a legacy clause independently", () => {
    expect(catalogueBoundTo({
      content: { ...CONTENT, checks: [CLOCK_SOURCES_CHECK, { ...LOOPS_CHECK, clause: CLOCK_SOURCES }] },
      bindings: new Map([["date-used-directly#clock-sources", [WALKER]], ["date-used-directly#loops", [ESLINT]]]),
    })).toMatchObject({ outcome: "ok", value: { checks: [
      { name: "clock-sources", clause: CLOCK_SOURCES, engines: [WALKER] },
      { name: "loops", clause: CLOCK_SOURCES, engines: [ESLINT] },
    ] } });
  });

  it("refuses naming each check whose clause no piece runs", () => {
    expect(catalogueBoundTo({ content: CONTENT, bindings: new Map([["date-used-directly#loops", [ESLINT]]]) })).toEqual({
      outcome: "failed",
      error: "no piece runs the clause of date-used-directly#clock-sources",
    });
  });
});

describe("holdingBoundTo", () => {
  it("binds a held catalogue", () => {
    expect(holdingBoundTo({ holding: { held: "catalogue", content: CONTENT }, bindings: BINDINGS })).toMatchObject({
      outcome: "ok",
      value: { held: "catalogue", catalogue: { checks: [{ name: "clock-sources", engines: [WALKER] }, { name: "loops", engines: [WALKER, ESLINT] }] } },
    });
  });

  it("holds none when no catalogue is held", () => {
    expect(holdingBoundTo({ holding: { held: "none" }, bindings: BINDINGS })).toEqual({ outcome: "ok", value: { held: "none" } });
  });

  it("refuses a held catalogue with a check no piece runs", () => {
    expect(holdingBoundTo({ holding: { held: "catalogue", content: CONTENT }, bindings: new Map() })).toEqual({
      outcome: "failed",
      error: "no piece runs the clause of date-used-directly#clock-sources, date-used-directly#loops",
    });
  });
});

import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { catalogueBoundTo, type EngineBindings, holdingBoundTo, pieceClauseKeyOf } from "./catalogue-binding.ts";
import type { CatalogueContent, CheckContent, Engine, RecordKind, Symptom } from "./symptom-catalogue.ts";

const WALKER: Engine = { name: "walker", mechanism: mechanismIdSchema.parse("audit") };

const ESLINT: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

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

const CLOCK_SOURCES = clauseAddressSchema.parse("CD-17#clock-sources");

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

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
  [pieceClauseKeyOf(CLOCK_SOURCES), [WALKER]],
  [pieceClauseKeyOf(LOOPS), [WALKER, ESLINT]],
]);

describe("pieceClauseKeyOf", () => {
  it("names a clause by its discipline and clause, whatever rule set it sits in", () => {
    expect(pieceClauseKeyOf(clauseAddressSchema.parse("team/CD-17#clock-sources"))).toBe("CD-17#clock-sources");
  });
});

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

  it("refuses naming each check whose clause no piece runs", () => {
    expect(catalogueBoundTo({ content: CONTENT, bindings: new Map([[pieceClauseKeyOf(LOOPS), [ESLINT]]]) })).toEqual({
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

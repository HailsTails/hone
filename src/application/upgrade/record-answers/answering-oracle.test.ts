import { describe, expect, it, vi } from "vitest";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { clauseAddressSchema, TOOL_RULE_SET } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { Result } from "../../../domain/result.ts";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { Finding, GovernedRun } from "../../../infrastructure/command-line/governance.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { createAnsweringOracle, type EngineFindings, type EnginePass, type EnginePassFailure } from "./answering-oracle.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = clauseAddressSchema.parse("CD-15#loops");

const TEST_BODY_CLAUSE = clauseAddressSchema.parse("CD-27#test-body-logic");

const LAYERING_CLAUSE = clauseAddressSchema.parse("CD-13#layering");

const LOOP_KEYWORD_LOOPS: Check = { name: "loops", symptom: LOOP_KEYWORD, clause: LOOPS_CLAUSE, engines: [WALKER, ESLINT_ENGINE], forms: [] };

const LOOP_KEYWORD_TEST_BODY: Check = { name: "test-body", symptom: LOOP_KEYWORD, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-for-loop"] };

const REBINDING_TEST_BODY: Check = { name: "test-body", symptom: REBINDING, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-let"] };

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "a-for-loop", symptom: LOOP_KEYWORD },
          { section: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: LAYERING_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }];

const SRC_A = repoPathSchema.parse("src/a.ts");

const CARVE_OUT: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const LOOP_FINDING: Finding = {
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const QUIET_RUN: GovernedRun = { mechanism: AUDIT, nativeExceptions: [], coverableKinds: [] };

const SUPPRESSING_RUN: GovernedRun = {
  mechanism: AUDIT,
  nativeExceptions: [{ kind: "inline-disable", clause: LOOPS_CLAUSE, file: SRC_A, line: 3, text: "eslint-disable-next-line", reach: "one-clause" }],
  coverableKinds: ["inline-disable"],
};

const oracleOver = (request: { readonly pass: Result<EngineFindings, EnginePassFailure> }) => {
  const enginePass: EnginePass = { findingsFor: vi.fn<EnginePass["findingsFor"]>().mockResolvedValue(request.pass) };
  return { enginePass, oracle: createAnsweringOracle({ enginePass, catalogues: CATALOGUES }) };
};

describe("createAnsweringOracle", () => {
  it("credits a carve-out with the check of a finding the version 1 answerer let it exempt", async () => {
    const { oracle } = oracleOver({ pass: { outcome: "ok", value: { findings: [LOOP_FINDING], runs: [QUIET_RUN] } } });
    expect(await oracle.answer({ records: [CARVE_OUT] })).toEqual({
      outcome: "ok",
      value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }],
    });
  });

  it("answers nothing for a carve-out no finding and no suppression reached", async () => {
    const { oracle } = oracleOver({ pass: { outcome: "ok", value: { findings: [], runs: [QUIET_RUN] } } });
    expect(await oracle.answer({ records: [CARVE_OUT] })).toEqual({ outcome: "ok", value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } }] });
  });

  it("answers suppression-only for a carve-out only a native suppression at its clause and file reached", async () => {
    const { oracle } = oracleOver({ pass: { outcome: "ok", value: { findings: [], runs: [SUPPRESSING_RUN] } } });
    expect(await oracle.answer({ records: [CARVE_OUT] })).toEqual({
      outcome: "ok",
      value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "suppression-only" } }],
    });
  });

  it("asks the engine pass for the findings with every record the file holds", async () => {
    const authorised: ExceptionRecord = { kind: "authorised-location", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: repoPathSchema.parse("src/b.ts"), reason: "kept" };
    const { oracle, enginePass } = oracleOver({ pass: { outcome: "ok", value: { findings: [], runs: [QUIET_RUN] } } });
    await oracle.answer({ records: [authorised, CARVE_OUT] });
    expect(enginePass.findingsFor).toHaveBeenCalledWith({ records: [authorised, CARVE_OUT] });
  });

  it("fails as the engine pass did when it could not run", async () => {
    const { oracle } = oracleOver({ pass: { outcome: "failed", error: { kind: "version-one-run-failed", detail: "the eslint runner threw" } } });
    expect(await oracle.answer({ records: [CARVE_OUT] })).toEqual({ outcome: "failed", error: { kind: "version-one-run-failed", detail: "the eslint runner threw" } });
  });
});

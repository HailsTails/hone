import { describe, expect, it } from "vitest";

import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  RecordInput,
  WrittenRecord,
} from "../../../domain/records/upgrade/records-mapping.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { reachBeyondEntriesOf } from "./written-reach.ts";

const AUDIT = "walker" as const;

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const LOOP_KEYWORD: Symptom = {
  ruleSet: "hone",
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  ruleSet: "hone",
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
  findingSpecifics: [],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  page: "rebinding/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
  findingSpecifics: [],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { form: "a-for-loop", symptom: LOOP_KEYWORD },
          { form: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: LAYERING_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

const SRC_A = repoPathOf("src/a.ts");

const CARVE_OUT_INPUT: RecordInput = {
  kind: "file-carve-out",
  record: {
    kind: "file-carve-out",
    clause: LOOPS_CLAUSE,
    mechanism: AUDIT,
    file: SRC_A,
    reason: "legacy loop",
  },
  entry: { kind: "file-carve-out" },
  answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] },
};

const AUTHORISED_INPUT: RecordInput = {
  kind: "authorised-location",
  record: { clause: TEST_BODY_CLAUSE, file: SRC_A },
  entry: { kind: "authorised-location" },
  answer: { reach: "whole-clause" },
};

const DEBT: WrittenRecord = {
  answers: "loop-keyword#loops",
  file: "src/a.ts",
  note: "legacy loop",
};

const BOTH_INPUTS: readonly RecordInput[] = [CARVE_OUT_INPUT, AUTHORISED_INPUT];

const reachBeyond = (request: {
  readonly written: readonly WrittenRecord[];
  readonly inputs: readonly RecordInput[];
}) =>
  reachBeyondEntriesOf({
    written: request.written,
    inputs: request.inputs,
    catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }],
  });

describe("reachBeyondEntriesOf", () => {
  it("finds no record beyond the entries when each sits at a check of one entry's clause and file", () => {
    expect(
      reachBeyond({
        written: [
          DEBT,
          {
            answers: "rebinding#test-body",
            file: "src/a.ts",
            carried: { kind: "authorised-location" },
          },
        ],
        inputs: BOTH_INPUTS,
      }),
    ).toEqual([]);
  });

  it("names a whole-symptom record, which reaches every check of the symptom", () => {
    expect(
      reachBeyond({
        written: [{ answers: "loop-keyword", file: "src/a.ts", note: "x" }],
        inputs: BOTH_INPUTS,
      }),
    ).toEqual([{ symptom: "loop-keyword", file: "src/a.ts" }]);
  });

  it("names a record at a file no entry holds", () => {
    expect(reachBeyond({ written: [{ ...DEBT, file: "src/b.ts" }], inputs: BOTH_INPUTS })).toEqual([
      { symptom: "loop-keyword#loops", file: "src/b.ts" },
    ]);
  });

  it("names a record at a check of a clause no entry holds at that file", () => {
    expect(
      reachBeyond({
        written: [{ answers: "rebinding#test-body", file: "src/a.ts", note: "x" }],
        inputs: [CARVE_OUT_INPUT],
      }),
    ).toEqual([{ symptom: "rebinding#test-body", file: "src/a.ts" }]);
  });

  it("names a record at a check the catalogue does not hold", () => {
    expect(
      reachBeyond({
        written: [{ answers: "loop-keyword#unknown", file: "src/a.ts", note: "x" }],
        inputs: BOTH_INPUTS,
      }),
    ).toEqual([{ symptom: "loop-keyword#unknown", file: "src/a.ts" }]);
  });

  it("names every record when no entry was held", () => {
    expect(reachBeyond({ written: [DEBT], inputs: [] })).toEqual([
      { symptom: "loop-keyword#loops", file: "src/a.ts" },
    ]);
  });
});

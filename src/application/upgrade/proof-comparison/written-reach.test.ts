import { describe, expect, it } from "vitest";
import { LOOP_KEYWORD_LOOPS, LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../../tests/settings-catalogue.ts";
import { TOOL_RULE_SET } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { RecordInput, WrittenRecord } from "../../../infrastructure/hone-records-folder/records-mapping.ts";
import { reachBeyondEntriesOf } from "./written-reach.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const CARVE_OUT_INPUT: RecordInput = {
  kind: "file-carve-out",
  record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" },
  entry: { kind: "file-carve-out" },
  answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] },
};

const AUTHORISED_INPUT: RecordInput = {
  kind: "authorised-location",
  record: { clause: TEST_BODY_CLAUSE, file: SRC_A },
  entry: { kind: "authorised-location" },
  answer: { reach: "whole-clause" },
};

const DEBT: WrittenRecord = { answers: "loop-keyword#loops", file: "src/a.ts", note: "legacy loop" };

const BOTH_INPUTS: readonly RecordInput[] = [CARVE_OUT_INPUT, AUTHORISED_INPUT];

const reachBeyond = (request: { readonly written: readonly WrittenRecord[]; readonly inputs: readonly RecordInput[] }) =>
  reachBeyondEntriesOf({ written: request.written, inputs: request.inputs, catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }] });

describe("reachBeyondEntriesOf", () => {
  it("finds no record beyond the entries when each sits at a check of one entry's clause and file", () => {
    expect(
      reachBeyond({
        written: [DEBT, { answers: "rebinding#test-body", file: "src/a.ts", carried: { kind: "authorised-location" } }],
        inputs: BOTH_INPUTS,
      }),
    ).toEqual([]);
  });

  it("names a whole-symptom record, which reaches every check of the symptom", () => {
    expect(reachBeyond({ written: [{ answers: "loop-keyword", file: "src/a.ts", note: "x" }], inputs: BOTH_INPUTS })).toEqual([{ symptom: "loop-keyword", file: "src/a.ts" }]);
  });

  it("names a record at a file no entry holds", () => {
    expect(reachBeyond({ written: [{ ...DEBT, file: "src/b.ts" }], inputs: BOTH_INPUTS })).toEqual([{ symptom: "loop-keyword#loops", file: "src/b.ts" }]);
  });

  it("names a record at a check of a clause no entry holds at that file", () => {
    expect(reachBeyond({ written: [{ answers: "rebinding#test-body", file: "src/a.ts", note: "x" }], inputs: [CARVE_OUT_INPUT] })).toEqual([
      { symptom: "rebinding#test-body", file: "src/a.ts" },
    ]);
  });

  it("names a record at a check the catalogue does not hold", () => {
    expect(reachBeyond({ written: [{ answers: "loop-keyword#unknown", file: "src/a.ts", note: "x" }], inputs: BOTH_INPUTS })).toEqual([{ symptom: "loop-keyword#unknown", file: "src/a.ts" }]);
  });

  it("names every record when no entry was held", () => {
    expect(reachBeyond({ written: [DEBT], inputs: [] })).toEqual([{ symptom: "loop-keyword#loops", file: "src/a.ts" }]);
  });
});

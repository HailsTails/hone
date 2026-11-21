import { describe, expect, it } from "vitest";
import { VERSION_ONE_CAUSAL_WHY_CHAIN } from "../../../../tests/version-one-causal-why-chain.ts";
import { LOOPS_CLAUSE, SETTINGS_CATALOGUE } from "../../../../tests/settings-catalogue.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { HeadRecord } from "../../../infrastructure/discipline-exceptions-folder/head-records.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { FileCarveOutRecord } from "./record-answer-oracle.ts";
import { recordInputsOf } from "./record-inputs.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const [LOOP_KEYWORD_LOOPS] = SETTINGS_CATALOGUE.checks;

const CARVE_OUT: FileCarveOutRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: repoPathSchema.parse("src/a.ts"), reason: "legacy loop" };

const AUTHORISED: Extract<ExceptionRecord, { readonly kind: "authorised-location" }> = {
  kind: "authorised-location",
  clause: LOOPS_CLAUSE,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/b.ts"),
  reason: "kept",
};

const CLAUSE_WIDE: Extract<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }> = {
  kind: "clause-wide-carve-out",
  clause: LOOPS_CLAUSE,
  mechanism: AUDIT,
  reason: "generated",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const CARVE_OUT_HEAD: HeadRecord = { kind: "file-carve-out", record: CARVE_OUT, entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" } };

const AUTHORISED_HEAD: HeadRecord = {
  kind: "authorised-location",
  record: AUTHORISED,
  entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/b.ts", reason: "kept" },
};

const CLAUSE_WIDE_HEAD: HeadRecord = { kind: "clause-wide-carve-out", record: CLAUSE_WIDE };

describe("recordInputsOf", () => {
  it("gives a file carve-out the answer the oracle gave for that very record", () => {
    expect(recordInputsOf({ heads: [CARVE_OUT_HEAD], answered: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }] })).toEqual({
      outcome: "ok",
      value: [{ ...CARVE_OUT_HEAD, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }],
    });
  });

  it("gives an authorised location the answer the oracle gave for that very record", () => {
    expect(
      recordInputsOf({ heads: [AUTHORISED_HEAD], answered: [{ kind: "authorised-location", record: AUTHORISED, answer: { reach: "answered-checks", checks: [LOOP_KEYWORD_LOOPS] } }] }),
    ).toEqual({ outcome: "ok", value: [{ ...AUTHORISED_HEAD, answer: { reach: "answered-checks", checks: [LOOP_KEYWORD_LOOPS] } }] });
  });

  it("passes a clause-wide carve-out through as it was read, and keeps every record in the order it came", () => {
    expect(
      recordInputsOf({
        heads: [AUTHORISED_HEAD, CARVE_OUT_HEAD, CLAUSE_WIDE_HEAD],
        answered: [
          { kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } },
          { kind: "authorised-location", record: AUTHORISED, answer: { reach: "whole-clause" } },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ ...AUTHORISED_HEAD, answer: { reach: "whole-clause" } }, { ...CARVE_OUT_HEAD, answer: { credit: "nothing" } }, CLAUSE_WIDE_HEAD],
    });
  });

  it("fails naming the clause and file of an authorised location the oracle gave no answer for", () => {
    expect(recordInputsOf({ heads: [AUTHORISED_HEAD], answered: [] })).toEqual({
      outcome: "failed",
      error: { kind: "location-unanswered", clause: "CD-15#loops", file: "src/b.ts" },
    });
  });

  it("fails naming the clause and file of a file carve-out the oracle gave no answer for", () => {
    expect(recordInputsOf({ heads: [CARVE_OUT_HEAD], answered: [] })).toEqual({
      outcome: "failed",
      error: { kind: "carve-out-unanswered", clause: "CD-15#loops", file: "src/a.ts" },
    });
  });
});

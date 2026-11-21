import { describe, expect, it } from "vitest";
import { LOOP_KEYWORD_LOOPS, LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../tests/settings-catalogue.ts";
import type { RuleSetCatalogue } from "../../domain/settings/check-choices.ts";
import type { Check } from "../../domain/language-layer/symptom-catalogue.ts";
import { mechanismIdSchema } from "../hone-config-file/identifiers.ts";
import { repoPathSchema } from "./repo-path.ts";
import type { InheritedDebtProvenance } from "../../domain/records/discipline-exceptions/exception-record.ts";
import { mappedRecords } from "./records-mapping.ts";

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: "hone", catalogue: SETTINGS_CATALOGUE }];

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const SRC_B = repoPathSchema.parse("src/b.ts");

const REBINDING_CHECK: Check = {
  ...LOOP_KEYWORD_LOOPS,
  name: "test-body",
  symptom: { ...LOOP_KEYWORD_LOOPS.symptom, name: "rebinding" },
  clause: TEST_BODY_CLAUSE,
};

const LOOP_KEYWORD_TEST_BODY: Check = { ...LOOP_KEYWORD_LOOPS, name: "test-body", clause: TEST_BODY_CLAUSE };

const WHY = { why: "a loop was written", because: "it was quicker", evidence: "the commit" } as const;

const WHY_CHAIN = {
  whys: [WHY, WHY, WHY, WHY, WHY],
  rootCause: "no rule at the time",
  owner: "the team",
} as const;

const PROVENANCE: InheritedDebtProvenance = { kind: "inherited-debt", source: "the old repository", decision: "keep until rewritten" };

const WHOLE_CLAUSE = { reach: "whole-clause" } as const;

const FINDINGS_ON_LOOPS = { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } as const;

describe("mappedRecords carrying a file carve-out as stated debt", () => {
  it("writes a debt at the check the carve-out answered in the file, its reason as the note", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/debt/loop-keyword.json",
            version: 2,
            records: [{ answers: "loop-keyword#loops", file: "src/a.ts", note: "legacy loop" }],
          },
        ],
      },
    });
  });

  it("writes no note for a carve-out that gave no reason", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts" },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [{ file: "hone-records/debt/loop-keyword.json", version: 2, records: [{ answers: "loop-keyword#loops", file: "src/a.ts" }] }],
      },
    });
  });

  it("writes one debt for a check that answered the carve-out twice", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
            answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_LOOPS] },
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/debt/loop-keyword.json",
            version: 2,
            records: [{ answers: "loop-keyword#loops", file: "src/a.ts", note: "legacy loop" }],
          },
        ],
      },
    });
  });

  it("writes a debt for each distinct check the carve-out answered, in the file of that check's symptom", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: TEST_BODY_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy" },
            entry: { kind: "file-carve-out", clause: "CD-27#test-body-logic", file: "src/a.ts", reason: "legacy" },
            answer: { credit: "findings", checks: [REBINDING_CHECK, LOOP_KEYWORD_LOOPS] },
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/debt/loop-keyword.json",
            version: 2,
            records: [{ answers: "loop-keyword#loops", file: "src/a.ts", note: "legacy" }],
          },
          {
            file: "hone-records/debt/rebinding.json",
            version: 2,
            records: [{ answers: "rebinding#test-body", file: "src/a.ts", note: "legacy" }],
          },
        ],
      },
    });
  });
});

describe("mappedRecords carrying what version 2 has no field for", () => {
  it("carries a file carve-out with a why chain word for word", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop", whyChain: WHY_CHAIN },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop", whyChain: WHY_CHAIN },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/debt/loop-keyword.json",
            version: 2,
            records: [
              {
                answers: "loop-keyword#loops",
                file: "src/a.ts",
                carried: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop", whyChain: WHY_CHAIN },
              },
            ],
          },
        ],
      },
    });
  });

  it("carries an inherited-debt carve-out, its provenance kept in the entry", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, provenance: PROVENANCE },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", provenance: PROVENANCE },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/debt/loop-keyword.json",
            version: 2,
            records: [
              {
                answers: "loop-keyword#loops",
                file: "src/a.ts",
                carried: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", provenance: PROVENANCE },
              },
            ],
          },
        ],
      },
    });
  });

  it("carries an authorised location nothing answered at each check of its clause, word for word", () => {
    const entry = { kind: "authorised-location", clause: "CD-27#test-body-logic", file: "src/a.ts", reason: "the tests need it" } as const;
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "authorised-location",
            record: { clause: TEST_BODY_CLAUSE, file: SRC_A },
            entry,
            answer: WHOLE_CLAUSE,
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/authorised-locations/loop-keyword.json",
            version: 2,
            records: [{ answers: "loop-keyword#test-body", file: "src/a.ts", carried: entry }],
          },
          {
            file: "hone-records/authorised-locations/rebinding.json",
            version: 2,
            records: [{ answers: "rebinding#test-body", file: "src/a.ts", carried: entry }],
          },
        ],
      },
    });
  });

  it("carries an authorised location only at the check its findings named", () => {
    const entry = { kind: "authorised-location", clause: "CD-27#test-body-logic", file: "src/a.ts", reason: "the tests need it" } as const;
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "authorised-location",
            record: { clause: TEST_BODY_CLAUSE, file: SRC_A },
            entry,
            answer: { reach: "answered-checks", checks: [REBINDING_CHECK] },
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/authorised-locations/rebinding.json",
            version: 2,
            records: [{ answers: "rebinding#test-body", file: "src/a.ts", carried: entry }],
          },
        ],
      },
    });
  });

  it("carries an authorised location once at a check its findings named twice", () => {
    const entry = { kind: "authorised-location", clause: "CD-27#test-body-logic", file: "src/a.ts", reason: "the tests need it" } as const;
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "authorised-location",
            record: { clause: TEST_BODY_CLAUSE, file: SRC_A },
            entry,
            answer: { reach: "answered-checks", checks: [REBINDING_CHECK, REBINDING_CHECK] },
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [{ file: "hone-records/authorised-locations/rebinding.json", version: 2, records: [{ answers: "rebinding#test-body", file: "src/a.ts", carried: entry }] }],
      },
    });
  });

  it("carries an authorised location at each of the two checks its findings named, in the file of each check's symptom", () => {
    const entry = { kind: "authorised-location", clause: "CD-27#test-body-logic", file: "src/a.ts", reason: "the tests need it" } as const;
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "authorised-location",
            record: { clause: TEST_BODY_CLAUSE, file: SRC_A },
            entry,
            answer: { reach: "answered-checks", checks: [REBINDING_CHECK, LOOP_KEYWORD_TEST_BODY] },
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          { file: "hone-records/authorised-locations/loop-keyword.json", version: 2, records: [{ answers: "loop-keyword#test-body", file: "src/a.ts", carried: entry }] },
          { file: "hone-records/authorised-locations/rebinding.json", version: 2, records: [{ answers: "rebinding#test-body", file: "src/a.ts", carried: entry }] },
        ],
      },
    });
  });

  it("carries an authorised location that has an existing-authorisation provenance, whole", () => {
    const provenance = { kind: "existing-authorisation", source: "the old repository" } as const;
    const entry = { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "ported", provenance } as const;
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "authorised-location",
            record: { clause: LOOPS_CLAUSE, file: SRC_A },
            entry,
            answer: WHOLE_CLAUSE,
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/authorised-locations/loop-keyword.json",
            version: 2,
            records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: entry }],
          },
        ],
      },
    });
  });
});

describe("mappedRecords refusing what carries over to nothing", () => {
  it("refuses a clause-wide carve-out, naming the clause", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "clause-wide-carve-out",
            record: { kind: "clause-wide-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, reason: "generated code", whyChain: WHY_CHAIN },
          },
        ],
      }),
    ).toEqual({ outcome: "failed", error: [{ kind: "clause-wide-carve-out", clause: "CD-15#loops" }] });
  });

  it("refuses a stale file carve-out, naming the clause and the file", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
            answer: { credit: "nothing" },
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "record-answers-nothing", clause: "CD-15#loops", file: "src/a.ts", credited: "nothing" }],
    });
  });

  it("refuses a file carve-out credited only by a suppression, apart from a stale one", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
            answer: { credit: "suppression-only" },
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "record-answers-nothing", clause: "CD-15#loops", file: "src/a.ts", credited: "suppression-only" }],
    });
  });

  it("refuses an authorised location whose clause has no check", () => {
    expect(
      mappedRecords({
        catalogues: [],
        inputs: [
          {
            kind: "authorised-location",
            record: { clause: LOOPS_CLAUSE, file: SRC_A },
            entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "ported" },
            answer: WHOLE_CLAUSE,
          },
        ],
      }),
    ).toEqual({ outcome: "failed", error: [{ kind: "clause-without-check", clause: "CD-15#loops" }] });
  });
});

describe("mappedRecords refusing a symptom name that cannot name a records file", () => {
  it("refuses an authorised location at a check whose symptom name is not a records name, naming it", () => {
    const check: Check = { ...LOOP_KEYWORD_LOOPS, symptom: { ...LOOP_KEYWORD_LOOPS.symptom, name: "Bad Name" } };
    expect(
      mappedRecords({
        catalogues: [{ ruleSet: "hone", catalogue: { ...SETTINGS_CATALOGUE, checks: [check] } }],
        inputs: [
          {
            kind: "authorised-location",
            record: { clause: LOOPS_CLAUSE, file: SRC_A },
            entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "ported" },
            answer: WHOLE_CLAUSE,
          },
        ],
      }),
    ).toEqual({ outcome: "failed", error: [{ kind: "records-name-refused", name: "Bad Name" }] });
  });
});

describe("mappedRecords ordering", () => {
  it("sorts the documents by file and keeps the records of a file in the order they came", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: TEST_BODY_CLAUSE, mechanism: AUDIT, file: SRC_B },
            entry: { kind: "file-carve-out", clause: "CD-27#test-body-logic", file: "src/b.ts" },
            answer: { credit: "findings", checks: [REBINDING_CHECK] },
          },
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_B },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts" },
            answer: FINDINGS_ON_LOOPS,
          },
          {
            kind: "file-carve-out",
            record: { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts" },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/debt/loop-keyword.json",
            version: 2,
            records: [
              { answers: "loop-keyword#loops", file: "src/b.ts" },
              { answers: "loop-keyword#loops", file: "src/a.ts" },
            ],
          },
          { file: "hone-records/debt/rebinding.json", version: 2, records: [{ answers: "rebinding#test-body", file: "src/b.ts" }] },
        ],
      },
    });
  });
});

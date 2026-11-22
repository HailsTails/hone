import { describe, expect, it } from "vitest";

import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { Result } from "../../result.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import type { InheritedDebtProvenance } from "../discipline-exceptions/exception-record.ts";
import { clausesCarriedAsNotAdopted, mappedRecords } from "./records-mapping.ts";
import type { UpgradeRefusal } from "./upgrade-refusal.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT: Engine = { name: "eslint" };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = { ...LOOP_KEYWORD, name: "rebinding", title: "Rebinding" };

const LOOPS_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT],
  forms: [],
};

const CATALOGUE_LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
};

const CATALOGUE_REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [WALKER, ESLINT],
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
  checks: [LOOP_KEYWORD_LOOPS, CATALOGUE_LOOP_KEYWORD_TEST_BODY, CATALOGUE_REBINDING_TEST_BODY],
  namedBans: [],
};

const CATALOGUES: readonly RuleSetCatalogue[] = [
  { ruleSet: "hone", catalogue: SETTINGS_CATALOGUE },
];

const AUDIT = "walker" as const;

const SRC_A = repoPathOf("src/a.ts");

const SRC_B = repoPathOf("src/b.ts");

const REBINDING_CHECK: Check = {
  ...LOOP_KEYWORD_LOOPS,
  name: "test-body",
  symptom: { ...LOOP_KEYWORD_LOOPS.symptom, name: "rebinding" },
  clause: TEST_BODY_CLAUSE,
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  ...LOOP_KEYWORD_LOOPS,
  name: "test-body",
  clause: TEST_BODY_CLAUSE,
};

const WHY = {
  why: "a loop was written",
  because: "it was quicker",
  evidence: "the commit",
} as const;

const WHY_CHAIN = {
  whys: [WHY, WHY, WHY, WHY, WHY],
  rootCause: "no rule at the time",
  owner: "the team",
} as const;

const PROVENANCE: InheritedDebtProvenance = {
  kind: "inherited-debt",
  source: "the old repository",
  decision: "keep until rewritten",
};

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
            record: {
              kind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              reason: "legacy loop",
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "legacy loop",
            },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toMatchObject({
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
    ).toMatchObject({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/debt/loop-keyword.json",
            version: 2,
            records: [{ answers: "loop-keyword#loops", file: "src/a.ts" }],
          },
        ],
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
            record: {
              kind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              reason: "legacy loop",
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "legacy loop",
            },
            answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_LOOPS] },
          },
        ],
      }),
    ).toMatchObject({
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
            record: {
              kind: "file-carve-out",
              clause: TEST_BODY_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              reason: "legacy",
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-27#test-body-logic",
              file: "src/a.ts",
              reason: "legacy",
            },
            answer: { credit: "findings", checks: [REBINDING_CHECK, LOOP_KEYWORD_LOOPS] },
          },
        ],
      }),
    ).toMatchObject({
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
            record: {
              kind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              reason: "legacy loop",
              whyChain: WHY_CHAIN,
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "legacy loop",
              whyChain: WHY_CHAIN,
            },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toMatchObject({
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
                carried: {
                  kind: "file-carve-out",
                  clause: "CD-15#loops",
                  file: "src/a.ts",
                  reason: "legacy loop",
                  whyChain: WHY_CHAIN,
                },
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
            record: {
              kind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              provenance: PROVENANCE,
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-15#loops",
              file: "src/a.ts",
              provenance: PROVENANCE,
            },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toMatchObject({
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
                carried: {
                  kind: "file-carve-out",
                  clause: "CD-15#loops",
                  file: "src/a.ts",
                  provenance: PROVENANCE,
                },
              },
            ],
          },
        ],
      },
    });
  });

  it("carries an authorised location nothing answered at each check of its clause, word for word", () => {
    const entry = {
      kind: "authorised-location",
      clause: "CD-27#test-body-logic",
      file: "src/a.ts",
      reason: "the tests need it",
    } as const;
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
    ).toMatchObject({
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
    const entry = {
      kind: "authorised-location",
      clause: "CD-27#test-body-logic",
      file: "src/a.ts",
      reason: "the tests need it",
    } as const;
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
    ).toMatchObject({
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
    const entry = {
      kind: "authorised-location",
      clause: "CD-27#test-body-logic",
      file: "src/a.ts",
      reason: "the tests need it",
    } as const;
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
    ).toMatchObject({
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

  it("carries an authorised location at each of the two checks its findings named, in the file of each check's symptom", () => {
    const entry = {
      kind: "authorised-location",
      clause: "CD-27#test-body-logic",
      file: "src/a.ts",
      reason: "the tests need it",
    } as const;
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
    ).toMatchObject({
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

  it("carries an authorised location that has an existing-authorisation provenance, whole", () => {
    const provenance = { kind: "existing-authorisation", source: "the old repository" } as const;
    const entry = {
      kind: "authorised-location",
      clause: "CD-15#loops",
      file: "src/a.ts",
      reason: "ported",
      provenance,
    } as const;
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
    ).toMatchObject({
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

const SIX_TEST_BODY_CHECKS: readonly Check[] = [
  {
    name: "test-body",
    symptom: { ...LOOP_KEYWORD, name: "rebinding" },
    clause: TEST_BODY_CLAUSE,
    engines: [WALKER],
    forms: [],
  },
  {
    name: "test-body",
    symptom: { ...LOOP_KEYWORD, name: "loop-keyword" },
    clause: TEST_BODY_CLAUSE,
    engines: [WALKER],
    forms: [],
  },
  {
    name: "test-body",
    symptom: { ...LOOP_KEYWORD, name: "branch-in-a-test" },
    clause: TEST_BODY_CLAUSE,
    engines: [WALKER],
    forms: [],
  },
  {
    name: "test-body",
    symptom: { ...LOOP_KEYWORD, name: "text-past-its-reader" },
    clause: TEST_BODY_CLAUSE,
    engines: [WALKER],
    forms: [],
  },
  {
    name: "test-body",
    symptom: { ...LOOP_KEYWORD, name: "computed-value-in-a-test" },
    clause: TEST_BODY_CLAUSE,
    engines: [WALKER],
    forms: [],
  },
  {
    name: "test-body",
    symptom: { ...LOOP_KEYWORD, name: "claimed-type" },
    clause: TEST_BODY_CLAUSE,
    engines: [WALKER],
    forms: [],
  },
];

const SIX_CHECK_CATALOGUES: readonly RuleSetCatalogue[] = [
  {
    ruleSet: "hone",
    catalogue: {
      ...SETTINGS_CATALOGUE,
      clauses: [
        { clause: TEST_BODY_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
      ],
      checks: SIX_TEST_BODY_CHECKS,
    },
  },
];

const CLAUSE_WIDE_ON_LOOPS = {
  kind: "clause-wide-carve-out",
  record: {
    kind: "clause-wide-carve-out",
    clause: LOOPS_CLAUSE,
    mechanism: AUDIT,
    reason: "generated code",
    whyChain: WHY_CHAIN,
  },
} as const;

const CLAUSE_WIDE_ON_TEST_BODY = {
  kind: "clause-wide-carve-out",
  record: {
    kind: "clause-wide-carve-out",
    clause: TEST_BODY_CLAUSE,
    mechanism: AUDIT,
    reason: "the tests are generated",
    whyChain: WHY_CHAIN,
  },
} as const;

describe("mappedRecords carrying a clause-wide carve-out as a choice, not a record", () => {
  it("writes no record for it", () => {
    expect(mappedRecords({ catalogues: CATALOGUES, inputs: [CLAUSE_WIDE_ON_LOOPS] })).toMatchObject(
      {
        outcome: "ok",
        value: { documents: [] },
      },
    );
  });

  it("refuses a clause that has no check to not adopt, naming the clause", () => {
    expect(
      mappedRecords({
        catalogues: [],
        inputs: [CLAUSE_WIDE_ON_LOOPS],
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "clause-without-check", clause: "CD-15#loops" }],
    });
  });
});

describe("clausesCarriedAsNotAdopted", () => {
  it("names the clause of each clause-wide carve-out and no other record", () => {
    expect(
      clausesCarriedAsNotAdopted({
        inputs: [
          CLAUSE_WIDE_ON_LOOPS,
          {
            kind: "authorised-location",
            record: { clause: TEST_BODY_CLAUSE, file: SRC_A },
            entry: {},
            answer: WHOLE_CLAUSE,
          },
        ],
      }),
    ).toEqual([LOOPS_CLAUSE]);
  });
});

describe("mappedRecords refusing what carries over to nothing", () => {
  it("refuses a stale file carve-out, naming the clause and the file", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: {
              kind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              reason: "legacy loop",
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "legacy loop",
            },
            answer: { credit: "nothing" },
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: [
        {
          kind: "record-answers-nothing",
          clause: "CD-15#loops",
          file: "src/a.ts",
          credited: "nothing",
        },
      ],
    });
  });

  it("refuses a file carve-out credited only by a suppression, apart from a stale one", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: {
              kind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              reason: "legacy loop",
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "legacy loop",
            },
            answer: { credit: "suppression-only" },
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: [
        {
          kind: "record-answers-nothing",
          clause: "CD-15#loops",
          file: "src/a.ts",
          credited: "suppression-only",
        },
      ],
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
            entry: {
              kind: "authorised-location",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "ported",
            },
            answer: WHOLE_CLAUSE,
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "clause-without-check", clause: "CD-15#loops" }],
    });
  });
});

describe("mappedRecords refusing a symptom name that cannot name a records file", () => {
  it("refuses an authorised location at a check whose symptom name is not a records name, naming it", () => {
    const check: Check = {
      ...LOOP_KEYWORD_LOOPS,
      symptom: { ...LOOP_KEYWORD_LOOPS.symptom, name: "Bad Name" },
    };
    expect(
      mappedRecords({
        catalogues: [{ ruleSet: "hone", catalogue: { ...SETTINGS_CATALOGUE, checks: [check] } }],
        inputs: [
          {
            kind: "authorised-location",
            record: { clause: LOOPS_CLAUSE, file: SRC_A },
            entry: {
              kind: "authorised-location",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "ported",
            },
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
            record: {
              kind: "file-carve-out",
              clause: TEST_BODY_CLAUSE,
              mechanism: AUDIT,
              file: SRC_B,
            },
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
    ).toMatchObject({
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
          {
            file: "hone-records/debt/rebinding.json",
            version: 2,
            records: [{ answers: "rebinding#test-body", file: "src/b.ts" }],
          },
        ],
      },
    });
  });
});

describe("mappedRecords lines", () => {
  it("names a stated debt by the kind and clause it came from, the file it covers and the symptom it now answers", () => {
    expect(
      mappedRecords({
        catalogues: CATALOGUES,
        inputs: [
          {
            kind: "file-carve-out",
            record: {
              kind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              reason: "legacy loop",
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "legacy loop",
            },
            answer: FINDINGS_ON_LOOPS,
          },
        ],
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        lines: [
          {
            recordKind: "file-carve-out",
            clause: LOOPS_CLAUSE,
            file: SRC_A,
            newKind: "debt",
            check: LOOP_KEYWORD_LOOPS,
            holding: "stated",
          },
        ],
      },
    });
  });

  it("gives an authorised location one carried line at each check of its clause", () => {
    const entry = {
      kind: "authorised-location",
      clause: "CD-27#test-body-logic",
      file: "src/a.ts",
      reason: "the tests need it",
    } as const;
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
    ).toMatchObject({
      outcome: "ok",
      value: {
        lines: [
          {
            recordKind: "authorised-location",
            clause: TEST_BODY_CLAUSE,
            file: SRC_A,
            newKind: "authorised-location",
            check: CATALOGUE_LOOP_KEYWORD_TEST_BODY,
            holding: "carried",
          },
          {
            recordKind: "authorised-location",
            clause: TEST_BODY_CLAUSE,
            file: SRC_A,
            newKind: "authorised-location",
            check: CATALOGUE_REBINDING_TEST_BODY,
            holding: "carried",
          },
        ],
      },
    });
  });

  it("gives a clause-wide carve-out its reason, then one not-adopted line for the check of its clause", () => {
    expect(mappedRecords({ catalogues: CATALOGUES, inputs: [CLAUSE_WIDE_ON_LOOPS] })).toMatchObject(
      {
        outcome: "ok",
        value: {
          documents: [],
          lines: [
            { recordKind: "clause-wide-carve-out", clause: LOOPS_CLAUSE, reason: "generated code" },
            {
              recordKind: "clause-wide-carve-out",
              clause: LOOPS_CLAUSE,
              newKind: "not-adopted",
              check: LOOP_KEYWORD_LOOPS,
            },
          ],
        },
      },
    );
  });

  it("gives a clause-wide carve-out on CD-27 one not-adopted line at each of its six checks", () => {
    expect(
      mappedRecords({ catalogues: SIX_CHECK_CATALOGUES, inputs: [CLAUSE_WIDE_ON_TEST_BODY] }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        documents: [],
        lines: [
          {
            recordKind: "clause-wide-carve-out",
            clause: TEST_BODY_CLAUSE,
            reason: "the tests are generated",
          },
          {
            recordKind: "clause-wide-carve-out",
            clause: TEST_BODY_CLAUSE,
            newKind: "not-adopted",
            check: SIX_TEST_BODY_CHECKS[0],
          },
          {
            recordKind: "clause-wide-carve-out",
            clause: TEST_BODY_CLAUSE,
            newKind: "not-adopted",
            check: SIX_TEST_BODY_CHECKS[1],
          },
          {
            recordKind: "clause-wide-carve-out",
            clause: TEST_BODY_CLAUSE,
            newKind: "not-adopted",
            check: SIX_TEST_BODY_CHECKS[2],
          },
          {
            recordKind: "clause-wide-carve-out",
            clause: TEST_BODY_CLAUSE,
            newKind: "not-adopted",
            check: SIX_TEST_BODY_CHECKS[3],
          },
          {
            recordKind: "clause-wide-carve-out",
            clause: TEST_BODY_CLAUSE,
            newKind: "not-adopted",
            check: SIX_TEST_BODY_CHECKS[4],
          },
          {
            recordKind: "clause-wide-carve-out",
            clause: TEST_BODY_CLAUSE,
            newKind: "not-adopted",
            check: SIX_TEST_BODY_CHECKS[5],
          },
        ],
      },
    });
  });
});

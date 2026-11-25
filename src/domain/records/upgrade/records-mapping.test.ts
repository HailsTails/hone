import { describe, expect, it } from "vitest";

import type { ClauseChecks } from "../../language-layer/clause-checks.ts";
import { createRuleContent } from "../../language-layer/rule-content.ts";
import type {
  Check,
  Engine,
  Symptom,
  AuthorisedLocationKind,
} from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import type { InheritedDebtProvenance } from "../discipline-exceptions/exception-record.ts";
import { mappedRecords } from "./records-mapping.ts";

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT: Engine = { name: "eslint" };

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

const REBINDING: Symptom = { ...LOOP_KEYWORD, name: "rebinding", title: "Rebinding" };

const CONTENT = createRuleContent({ catalogues: [{ symptoms: [LOOP_KEYWORD, REBINDING] }] });

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
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT],
  forms: [],
  findingSpecifics: [],
};

const CATALOGUE_LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
  findingSpecifics: [],
};

const CATALOGUE_REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  page: "rebinding/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
  findingSpecifics: [],
};

const CLAUSE_CHECKS: ClauseChecks = new Map([
  ["CD-15#loops", [LOOP_KEYWORD_LOOPS]],
  ["CD-27#test-body-logic", [CATALOGUE_LOOP_KEYWORD_TEST_BODY, CATALOGUE_REBINDING_TEST_BODY]],
]);

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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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

  it("writes a team check's debt in its rule set's records folder", () => {
    const teamLoops: Check = {
      ...LOOP_KEYWORD_LOOPS,
      symptom: { ...LOOP_KEYWORD, ruleSet: { name: ruleSetNameOf("acme") } },
    };
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
            answer: { credit: "findings", checks: [teamLoops] },
          },
        ],
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { documents: [{ file: "hone-records/acme/debt/loop-keyword.json" }] },
    });
  });

  it("writes no note for a carve-out that gave no reason", () => {
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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

  it("writes the debt record for the check of a suppression a file carve-out held up, and lists it as a debt", () => {
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
        inputs: [
          {
            kind: "file-carve-out",
            record: {
              kind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              mechanism: AUDIT,
              file: SRC_A,
              reason: "kept for the legacy interop",
            },
            entry: {
              kind: "file-carve-out",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "kept for the legacy interop",
            },
            answer: { credit: "suppression-only", checks: [LOOP_KEYWORD_LOOPS] },
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
                note: "kept for the legacy interop",
              },
            ],
          },
        ],
        lines: [
          {
            recordKind: "file-carve-out",
            clause: LOOPS_CLAUSE,
            file: "src/a.ts",
            newKind: "debt",
            check: LOOP_KEYWORD_LOOPS,
            holding: "stated",
          },
        ],
      },
    });
  });

  it("writes one debt for a check that answered the carve-out twice", () => {
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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

describe("mappedRecords carrying an authorised location on outside imports", () => {
  const OUTSIDE_IMPORT_PAST_A_BOUNDARY: Symptom = {
    ...LOOP_KEYWORD,
    name: "outside-import-past-a-boundary",
    title: "Outside import past a boundary",
    correctUses: [
      {
        situation: "the adapter for that outside party",
        kind: AUTHORISED_LOCATION,
        binding: "check-file-and-outside-party",
      },
    ],
  };
  const IMPORT_CONTENT = createRuleContent({
    catalogues: [{ symptoms: [OUTSIDE_IMPORT_PAST_A_BOUNDARY] }],
  });
  const IMPORTS_CLAUSE: ClauseAddress = {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-19"),
    clause: clauseIdOf("import-or-require"),
  };
  const IMPORT_CHECK: Check = {
    name: "import-or-require",
    symptom: OUTSIDE_IMPORT_PAST_A_BOUNDARY,
    page: "outside-import-past-a-boundary/import-or-require.md",
    clause: IMPORTS_CLAUSE,
    engines: [ESLINT],
    forms: [],
    findingSpecifics: ["outside-party"],
  };
  const IMPORT_CLAUSE_CHECKS: ClauseChecks = new Map([["CD-19#import-or-require", [IMPORT_CHECK]]]);
  const IDS_ENTRY = {
    kind: "authorised-location",
    clause: "CD-19#import-or-require",
    file: "src/adapters/ids.ts",
    reason: "the ids adapter",
  } as const;
  const IDS_INPUT = {
    kind: "authorised-location",
    record: { clause: IMPORTS_CLAUSE, file: repoPathOf("src/adapters/ids.ts") },
    entry: IDS_ENTRY,
    answer: WHOLE_CLAUSE,
  } as const;
  const IDS_RECORD = {
    answers: "outside-import-past-a-boundary#import-or-require",
    file: "src/adapters/ids.ts",
    carried: IDS_ENTRY,
  };
  const IDS_LINE = {
    recordKind: "authorised-location",
    clause: IMPORTS_CLAUSE,
    file: "src/adapters/ids.ts",
    newKind: "authorised-location",
    check: IMPORT_CHECK,
    holding: "carried",
  };

  it("carries one record for each confined package, in the order configured, then one for node modules", () => {
    const mapped = mappedRecords({
      confinedOutsideDependencies: ["uuid", "zod"],
      clauseChecks: IMPORT_CLAUSE_CHECKS,
      content: IMPORT_CONTENT,
      inputs: [IDS_INPUT],
    });

    expect(mapped).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/authorised-locations/outside-import-past-a-boundary.json",
            version: 2,
            records: [
              { ...IDS_RECORD, outsideParty: "uuid" },
              { ...IDS_RECORD, outsideParty: "zod" },
              { ...IDS_RECORD, outsideParty: "node:" },
            ],
          },
        ],
        lines: [
          { ...IDS_LINE, outsideParty: "uuid" },
          { ...IDS_LINE, outsideParty: "zod" },
          { ...IDS_LINE, outsideParty: "node:" },
        ],
      },
    });
  });

  it("carries one record for node modules alone when no package is confined", () => {
    const mapped = mappedRecords({
      confinedOutsideDependencies: [],
      clauseChecks: IMPORT_CLAUSE_CHECKS,
      content: IMPORT_CONTENT,
      inputs: [IDS_INPUT],
    });

    expect(mapped).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/authorised-locations/outside-import-past-a-boundary.json",
            version: 2,
            records: [{ ...IDS_RECORD, outsideParty: "node:" }],
          },
        ],
        lines: [{ ...IDS_LINE, outsideParty: "node:" }],
      },
    });
  });

  it("names no outside party on an authorised location whose symptom binds none, whatever is confined", () => {
    const entry = {
      kind: "authorised-location",
      clause: "CD-15#loops",
      file: "src/a.ts",
      reason: "ported",
    } as const;

    const mapped = mappedRecords({
      confinedOutsideDependencies: ["uuid"],
      clauseChecks: CLAUSE_CHECKS,
      content: CONTENT,
      inputs: [
        {
          kind: "authorised-location",
          record: { clause: LOOPS_CLAUSE, file: SRC_A },
          entry,
          answer: WHOLE_CLAUSE,
        },
      ],
    });

    expect(mapped).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/authorised-locations/loop-keyword.json",
            version: 2,
            records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: entry }],
          },
        ],
        lines: [
          {
            recordKind: "authorised-location",
            clause: LOOPS_CLAUSE,
            file: SRC_A,
            newKind: "authorised-location",
            check: LOOP_KEYWORD_LOOPS,
            holding: "carried",
          },
        ],
      },
    });
  });

  it("refuses an authorised location on CD-14, whose clause has no check, whatever is confined", () => {
    const clauseChecks: ClauseChecks = new Map([["CD-19#import-or-require", [IMPORT_CHECK]]]);
    const noCheckClause: ClauseAddress = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-14"),
      clause: clauseIdOf("value-objects"),
    };

    const mapped = mappedRecords({
      confinedOutsideDependencies: ["uuid"],
      clauseChecks: IMPORT_CLAUSE_CHECKS,
      content: IMPORT_CONTENT,
      inputs: [
        {
          kind: "authorised-location",
          record: { clause: noCheckClause, file: SRC_A },
          entry: {
            kind: "authorised-location",
            clause: "CD-14#value-objects",
            file: "src/a.ts",
            reason: "ported",
          },
          answer: WHOLE_CLAUSE,
        },
      ],
    });

    expect(mapped).toEqual({
      outcome: "failed",
      error: [{ kind: "clause-without-check", clause: "CD-14#value-objects" }],
    });
  });
});

describe("mappedRecords leaving a clause-wide carve-out to the debt recorded by file", () => {
  it("writes no record for a clause-wide carve-out, and names its owner and its reason", () => {
    const mapped = mappedRecords({
      confinedOutsideDependencies: [],
      clauseChecks: CLAUSE_CHECKS,
      content: CONTENT,
      inputs: [CLAUSE_WIDE_ON_LOOPS],
    });

    expect(mapped).toEqual({
      outcome: "ok",
      value: {
        documents: [],
        lines: [
          {
            recordKind: "clause-wide-carve-out",
            clause: LOOPS_CLAUSE,
            newKind: "debt-by-file",
            reason: "generated code",
            owner: WHY_CHAIN.owner,
          },
        ],
      },
    });
  });

  it("writes the file carve-out on the same clause beside it", () => {
    const mapped = mappedRecords({
      confinedOutsideDependencies: [],
      clauseChecks: CLAUSE_CHECKS,
      content: CONTENT,
      inputs: [
        CLAUSE_WIDE_ON_LOOPS,
        {
          kind: "file-carve-out",
          record: {
            kind: "file-carve-out",
            clause: LOOPS_CLAUSE,
            mechanism: AUDIT,
            file: SRC_A,
          },
          entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts" },
          answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] },
        },
      ],
    });

    expect(mapped).toEqual({
      outcome: "ok",
      value: {
        documents: [
          {
            file: "hone-records/debt/loop-keyword.json",
            version: 2,
            records: [{ answers: "loop-keyword#loops", file: "src/a.ts" }],
          },
        ],
        lines: [
          {
            recordKind: "clause-wide-carve-out",
            clause: LOOPS_CLAUSE,
            newKind: "debt-by-file",
            reason: "generated code",
            owner: WHY_CHAIN.owner,
          },
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
});

describe("mappedRecords carrying nothing for a carve-out that answers nothing", () => {
  it("writes no record for a stale file carve-out and names it as not carried", () => {
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
      outcome: "ok",
      value: {
        documents: [],
        lines: [
          {
            recordKind: "file-carve-out",
            clause: LOOPS_CLAUSE,
            file: SRC_A,
            newKind: "not-carried",
          },
        ],
      },
    });
  });

  it("writes no record for a file carve-out credited only by a suppression no record can hold, and names it as not carried", () => {
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
            answer: { credit: "suppression-only", checks: [] },
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        documents: [],
        lines: [
          {
            recordKind: "file-carve-out",
            clause: LOOPS_CLAUSE,
            file: SRC_A,
            newKind: "not-carried",
          },
        ],
      },
    });
  });
});

describe("mappedRecords refusing what carries over to nothing", () => {
  it("refuses an authorised location whose clause has no check", () => {
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: new Map(),
        content: CONTENT,
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
    const content = createRuleContent({
      catalogues: [{ symptoms: [{ ...LOOP_KEYWORD, name: "Bad Name" }] }],
    });
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: new Map([["CD-15#loops", [check]]]),
        content,
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

describe("mappedRecords refusing a check whose symptom no catalogue holds", () => {
  it("refuses an authorised location at a check whose symptom the content does not hold, naming the symptom", () => {
    const loops: Check = {
      ...LOOP_KEYWORD_LOOPS,
      symptom: { ruleSet: "hone", name: "loop-keyword" },
    };
    const content = createRuleContent({ catalogues: [{ symptoms: [REBINDING] }] });

    const mapped = mappedRecords({
      confinedOutsideDependencies: [],
      clauseChecks: new Map([["CD-15#loops", [loops]]]),
      content,
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
    });

    expect(mapped).toEqual({
      outcome: "failed",
      error: [{ kind: "symptom-unheld", symptom: { ruleSet: "hone", name: "loop-keyword" } }],
    });
  });
});

describe("mappedRecords ordering", () => {
  it("sorts the documents by file and keeps the records of a file in the order they came", () => {
    expect(
      mappedRecords({
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
        confinedOutsideDependencies: [],
        clauseChecks: CLAUSE_CHECKS,
        content: CONTENT,
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
});

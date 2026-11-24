import { describe, expect, it } from "vitest";

import type { Finding } from "../../../domain/finding/governance.ts";
import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { GovernanceResult } from "../../../domain/records/discipline-exceptions/governance.ts";
import type { VersionOneWhyChain } from "../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { recordAnswersOf } from "./record-answers.ts";

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const SRC_A = repoPathOf("src/a.ts");

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: RecordKind = {
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
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  page: "rebinding/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
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

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: LOOPS_CLAUSE,
  mechanism: AUDIT,
  file: SRC_A,
  reason: "legacy loop",
};

const AUTHORISED: ExceptionRecord = {
  kind: "authorised-location",
  clause: TEST_BODY_CLAUSE,
  mechanism: AUDIT,
  file: SRC_A,
  reason: "kept",
};

const LOOP_FINDING: Finding = {
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const NOTHING_GOVERNED: GovernanceResult = {
  findings: [],
  exempted: [],
  stale: [],
  forfeited: [],
  doublyHeld: [],
  unrecorded: [],
};

const SUPPRESSION_IN_A = {
  kind: "inline-disable",
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  line: 3,
  text: "// @ts-expect-error legacy interop",
  reach: "one-clause",
} as const;

const catalogues: readonly RuleSetCatalogue[] = [
  { ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE },
];

describe("recordAnswersOf crediting a file carve-out with the findings it exempted", () => {
  it("credits the check a finding names", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: CARVE_OUT,
          answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] },
        },
      ],
    });
  });

  it("credits each check of the findings a carve-out exempted, in the order the findings came", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    const forLoop: Finding = {
      ...LOOP_FINDING,
      clause: TEST_BODY_CLAUSE,
      check: "loop-keyword#test-body",
    };
    const rebinding: Finding = {
      ...LOOP_FINDING,
      clause: TEST_BODY_CLAUSE,
      check: "rebinding#test-body",
    };
    expect(
      recordAnswersOf({
        records: [carveOut],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            { finding: forLoop, by: [carveOut] },
            { finding: rebinding, by: [carveOut] },
          ],
        },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: carveOut,
          answer: { credit: "findings", checks: [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] },
        },
      ],
    });
  });

  it("credits the one check of the clause run by the finding's mechanism when the finding names none", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            { finding: { ...LOOP_FINDING, mechanism: ESLINT, check: undefined }, by: [CARVE_OUT] },
          ],
        },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: CARVE_OUT,
          answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] },
        },
      ],
    });
  });

  it("fails when a finding names no check and its mechanism runs two checks of the clause", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    expect(
      recordAnswersOf({
        records: [carveOut],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            {
              finding: { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: undefined },
              by: [carveOut],
            },
          ],
        },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "finding-not-attributable",
        clause: "CD-27#test-body-logic",
        file: "src/a.ts",
        check: undefined,
      },
    });
  });

  it("credits the check the finding's symptom reading picks when its mechanism runs two checks of the clause", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    const letFinding: Finding = {
      ...LOOP_FINDING,
      clause: TEST_BODY_CLAUSE,
      check: undefined,
      remedy: { fix: "bind it once", form: "a-let" },
    };
    expect(
      recordAnswersOf({
        records: [carveOut],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: letFinding, by: [carveOut] }] },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: carveOut,
          answer: { credit: "findings", checks: [REBINDING_TEST_BODY] },
        },
      ],
    });
  });

  it("fails when a finding names a check its mechanism does not run, which version 2 would never site", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    const eslintFinding: Finding = {
      ...LOOP_FINDING,
      clause: TEST_BODY_CLAUSE,
      mechanism: ESLINT,
      check: "rebinding#test-body",
    };
    expect(
      recordAnswersOf({
        records: [carveOut],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: eslintFinding, by: [carveOut] }] },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "finding-not-attributable",
        clause: "CD-27#test-body-logic",
        file: "src/a.ts",
        check: "rebinding#test-body",
      },
    });
  });

  it("fails when a finding's clause belongs to a rule set with no catalogue", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] },
        runs: [],
        catalogues: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "finding-not-attributable",
        clause: "CD-15#loops",
        file: "src/a.ts",
        check: "loop-keyword#loops",
      },
    });
  });

  it("fails when a finding names a check the clause does not hold", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            { finding: { ...LOOP_FINDING, check: "rebinding#test-body" }, by: [CARVE_OUT] },
          ],
        },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "finding-not-attributable",
        clause: "CD-15#loops",
        file: "src/a.ts",
        check: "rebinding#test-body",
      },
    });
  });
});

describe("recordAnswersOf answering a file carve-out that exempted no finding", () => {
  it("answers nothing for a carve-out the governance found stale", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, stale: [CARVE_OUT] },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } }],
    });
  });

  it("answers suppression-only with the check of the native suppression a carve-out held up", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: NOTHING_GOVERNED,
        runs: [
          {
            mechanism: AUDIT,
            nativeExceptions: [SUPPRESSION_IN_A],
            coverableKinds: ["inline-disable"],
          },
        ],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: CARVE_OUT,
          answer: { credit: "suppression-only", checks: [LOOP_KEYWORD_LOOPS] },
        },
      ],
    });
  });

  it("answers suppression-only with no check when no recordable suppression sits at the carve-out's file", () => {
    expect(
      recordAnswersOf({ records: [CARVE_OUT], governed: NOTHING_GOVERNED, runs: [], catalogues }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: CARVE_OUT,
          answer: { credit: "suppression-only", checks: [] },
        },
      ],
    });
  });

  it("leaves a suppression in another file out of the checks a carve-out held up", () => {
    const elsewhere = { ...SUPPRESSION_IN_A, file: repoPathOf("src/b.ts") };
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: NOTHING_GOVERNED,
        runs: [
          { mechanism: AUDIT, nativeExceptions: [elsewhere], coverableKinds: ["inline-disable"] },
        ],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: CARVE_OUT,
          answer: { credit: "suppression-only", checks: [] },
        },
      ],
    });
  });

  it("fails for a carve-out on a clause and file an authorised location also holds", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: {
          ...NOTHING_GOVERNED,
          doublyHeld: [{ clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT }],
        },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "record-doubly-held", clause: "CD-15#loops", file: "src/a.ts" },
    });
  });
});

describe("recordAnswersOf crediting an authorised location with the findings it exempted", () => {
  const authorisedOnLoops: ExceptionRecord = { ...AUTHORISED, clause: LOOPS_CLAUSE };

  it("credits the check a finding names, and no other check of the clause", () => {
    expect(
      recordAnswersOf({
        records: [authorisedOnLoops],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [{ finding: LOOP_FINDING, by: [authorisedOnLoops] }],
        },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "authorised-location",
          record: authorisedOnLoops,
          answer: { reach: "answered-checks", checks: [LOOP_KEYWORD_LOOPS] },
        },
      ],
    });
  });

  it("credits each check of the findings it exempted, in the order the findings came", () => {
    const forLoop: Finding = {
      ...LOOP_FINDING,
      clause: TEST_BODY_CLAUSE,
      check: "loop-keyword#test-body",
    };
    const rebinding: Finding = {
      ...LOOP_FINDING,
      clause: TEST_BODY_CLAUSE,
      check: "rebinding#test-body",
    };
    expect(
      recordAnswersOf({
        records: [AUTHORISED],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            { finding: forLoop, by: [AUTHORISED] },
            { finding: rebinding, by: [AUTHORISED] },
          ],
        },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "authorised-location",
          record: AUTHORISED,
          answer: {
            reach: "answered-checks",
            checks: [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
          },
        },
      ],
    });
  });

  it("keeps the whole clause for a location that exempted no finding, stale or held up by a native suppression", () => {
    expect(
      recordAnswersOf({
        records: [AUTHORISED],
        governed: { ...NOTHING_GOVERNED, stale: [AUTHORISED] },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "authorised-location", record: AUTHORISED, answer: { reach: "whole-clause" } },
      ],
    });
    expect(
      recordAnswersOf({ records: [AUTHORISED], governed: NOTHING_GOVERNED, runs: [], catalogues }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "authorised-location", record: AUTHORISED, answer: { reach: "whole-clause" } },
      ],
    });
  });

  it("fails when a finding it exempted cannot be sited at a check", () => {
    expect(
      recordAnswersOf({
        records: [authorisedOnLoops],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            { finding: { ...LOOP_FINDING, check: "rebinding#test-body" }, by: [authorisedOnLoops] },
          ],
        },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "finding-not-attributable",
        clause: "CD-15#loops",
        file: "src/a.ts",
        check: "rebinding#test-body",
      },
    });
  });
});

describe("recordAnswersOf over every record of the file", () => {
  it("answers each file carve-out and authorised location, in the order the records were given, and leaves a clause-wide carve-out out", () => {
    const second: ExceptionRecord = { ...CARVE_OUT, file: repoPathOf("src/b.ts") };
    const clauseWide: ExceptionRecord = {
      kind: "clause-wide-carve-out",
      clause: LOOPS_CLAUSE,
      mechanism: AUDIT,
      reason: "generated",
      whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
    };
    expect(
      recordAnswersOf({
        records: [AUTHORISED, CARVE_OUT, clauseWide, second],
        governed: { ...NOTHING_GOVERNED, stale: [CARVE_OUT, second] },
        runs: [],
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "authorised-location", record: AUTHORISED, answer: { reach: "whole-clause" } },
        { kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } },
        { kind: "file-carve-out", record: second, answer: { credit: "nothing" } },
      ],
    });
  });
});

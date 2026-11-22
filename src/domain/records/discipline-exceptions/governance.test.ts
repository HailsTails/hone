import { describe, expect, it } from "vitest";

import type { Finding } from "../../finding/governance.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import type { NativeException } from "../../runner/runner-result-types.ts";
import type { ExceptionRecord } from "./exception-record.ts";
import { applyGovernance, type GovernanceRequest } from "./governance.ts";
import type { VersionOneWhyChain } from "./version-one-why-chain.ts";

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

const noClass = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("no-class-syntax"),
};
const noForOf = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("no-for-of"),
};
const probeNoClass = {
  ruleSet: { name: ruleSetNameOf("probe") },
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("no-class-syntax"),
};
const fileA = repoPathOf("src/a.ts");
const fileB = repoPathOf("src/b.ts");
const packageJson = repoPathOf("package.json");
const suppressions = repoPathOf("eslint-suppressions.json");
const audit = "walker" as const;
const eslint = "eslint" as const;

const noClassInA: Finding = {
  clause: noClass,
  file: fileA,
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
  mechanism: audit,
};

const noClassInB: Finding = {
  clause: noClass,
  file: fileB,
  anchor: { line: 8, column: 1 },
  snippet: "class B {}",
  mechanism: audit,
};

const locatedNoClassInA: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source:
      "fictional unit fixture core/governance/governance.test.ts#locatedNoClassInA; not historical authorisation",
  },
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the adapter factory wraps the parser's class",
};

const carvedNoClassInA: ExceptionRecord = {
  kind: "file-carve-out",
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the parser adapter is unpaid debt",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const carvedNoClassEverywhere: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: noClass,
  mechanism: audit,
  reason: "the whole clause is unpaid debt",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const locatedNoForOfInA: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source:
      "fictional unit fixture core/governance/governance.test.ts#locatedNoForOfInA; not historical authorisation",
  },
  clause: noForOf,
  mechanism: audit,
  file: fileA,
  reason: "the stream drain is an authorised site",
};

const carvedProbeNoClassInA: ExceptionRecord = {
  kind: "file-carve-out",
  clause: probeNoClass,
  mechanism: audit,
  file: fileA,
  reason: "the probe rule set's debt",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const scriptRuleOff = {
  kind: "command-line-option",
  clause: noClass,
  location: packageJson,
  script: "lint",
  option: "--rule no-class:off",
  cause: { kind: "weakens-run" },
} as const;

const expectationInA = {
  kind: "inline-disable",
  clause: noClass,
  file: fileA,
  line: 4,
  text: "// @ts-expect-error legacy",
  reach: "one-clause",
} as const;

const bareDisableInA = {
  kind: "inline-disable",
  clause: noClass,
  file: fileA,
  line: 1,
  text: "/* eslint-disable */",
  reach: "every-selected-clause",
} as const;

const inlineRun = (request: {
  readonly nativeExceptions: readonly NativeException[];
}): GovernanceRequest["runs"][number] => ({
  mechanism: audit,
  nativeExceptions: request.nativeExceptions,
  coverableKinds: ["inline-disable"],
});

const nothingTouched: TouchedSet = { measured: "yes", paths: new Set() };
const fileATouched: TouchedSet = { measured: "yes", paths: new Set([fileA]) };
const unmeasured: TouchedSet = { measured: "no", base: { state: "not-given" } };

const quietWalker = { mechanism: audit, nativeExceptions: [], coverableKinds: [] };

const nothingGoverned = {
  findings: [],
  exempted: [],
  stale: [],
  forfeited: [],
  doublyHeld: [],
  unrecorded: [],
};

describe("applyGovernance with no records", () => {
  it("keeps every finding and lists nothing else", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({ ...nothingGoverned, findings: [noClassInA] });
  });
});

describe("applyGovernance with provenance-only inherited debt", () => {
  it("preserves provenance when exempting untouched debt and forfeits the same complete record when touched", () => {
    const inheritedDebt: ExceptionRecord = {
      kind: "file-carve-out",
      clause: noClass,
      mechanism: audit,
      file: fileA,
      reason: "fictional inherited-debt fixture",
      provenance: {
        kind: "inherited-debt",
        source: "fictional unit input governance.test.ts; not historical debt",
        decision: "fictional initial baseline assertion; not a live debt decision",
      },
    };

    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [inheritedDebt],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [inheritedDebt] }],
    });
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [inheritedDebt],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInA],
      forfeited: [inheritedDebt],
    });
  });
});

describe("applyGovernance rule 3, exempt", () => {
  it("exempts a finding whose clause and file an authorised location names, and leaves it out of findings", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [locatedNoClassInA] }],
    });
  });

  it("exempts a finding whose clause and file an untouched file carve-out names", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [carvedNoClassInA] }],
    });
  });

  it("exempts a finding in any file whose clause a clause-wide carve-out names", () => {
    expect(
      applyGovernance({
        findings: [noClassInA, noClassInB],
        records: [carvedNoClassEverywhere],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [
        { finding: noClassInA, by: [carvedNoClassEverywhere] },
        { finding: noClassInB, by: [carvedNoClassEverywhere] },
      ],
    });
  });

  it("credits every record that names the finding, in the records' order", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassEverywhere, carvedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).exempted,
    ).toEqual([{ finding: noClassInA, by: [carvedNoClassEverywhere, carvedNoClassInA] }]);
  });

  it("does not exempt a finding in a file the record does not name", () => {
    expect(
      applyGovernance({
        findings: [noClassInB],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).findings,
    ).toEqual([noClassInB]);
  });

  it("does not exempt a finding of a clause the record does not name", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoForOfInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).findings,
    ).toEqual([noClassInA]);
  });

  it("does not exempt a shared clause's finding by a named rule set's record of the same discipline and clause", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedProbeNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).findings,
    ).toEqual([noClassInA]);
  });
});

describe("applyGovernance rule 1, forfeit", () => {
  it("forfeits a file carve-out whose file was touched, and it exempts nothing", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInA],
      forfeited: [carvedNoClassInA],
    });
  });

  it("does not forfeit an authorised location whose file was touched", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [locatedNoClassInA] }],
    });
  });

  it("does not forfeit a clause-wide carve-out when a file it covers was touched", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassEverywhere],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [carvedNoClassEverywhere] }],
    });
  });

  it("forfeits nothing when the touched set is unmeasured, so the file carve-out still exempts", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassInA],
        touched: unmeasured,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [carvedNoClassInA] }],
    });
  });
});

describe("applyGovernance rule 1, forfeiture assessed elsewhere", () => {
  it("forfeits nothing when the touched set is measured elsewhere, so the file carve-out still exempts", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassInA],
        touched: { measured: "elsewhere" },
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [carvedNoClassInA] }],
    });
  });
});

describe("applyGovernance rule 2, doubly held", () => {
  it("lists a clause and file held by both an authorised location and a file carve-out, and neither exempts", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoClassInA, carvedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInA],
      doublyHeld: [{ clause: noClass, file: fileA, mechanism: audit }],
    });
  });

  it("lists a doubly-held clause and file that no finding hits", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoClassInA, carvedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      doublyHeld: [{ clause: noClass, file: fileA, mechanism: audit }],
    });
  });

  it("does not list a pair whose file carve-out was forfeited, and the authorised location exempts", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoClassInA, carvedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [locatedNoClassInA] }],
      forfeited: [carvedNoClassInA],
    });
  });
});

describe("applyGovernance rule 4, stale", () => {
  it("lists a record in force that is credited for no finding", () => {
    expect(
      applyGovernance({
        findings: [noClassInB],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInB],
      stale: [locatedNoClassInA],
    });
  });

  it("lists an uncredited clause-wide carve-out", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassEverywhere],
        touched: nothingTouched,
        runs: [quietWalker],
      }).stale,
    ).toEqual([carvedNoClassEverywhere]);
  });

  it("does not list a forfeited record as stale", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }).stale,
    ).toEqual([]);
  });
});

describe("applyGovernance rule 4, records credited by a native exception they hold", () => {
  it("does not list a file record as stale when it holds an inline disable and no finding", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassInA],
        touched: nothingTouched,
        runs: [inlineRun({ nativeExceptions: [expectationInA] })],
      }).stale,
    ).toEqual([]);
  });

  it("does not list a record as stale when it holds a coverable native exception and no finding", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...locatedNoClassInA, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            coverableKinds: ["config-override"],
          },
        ],
      }).stale,
    ).toEqual([]);
  });

  it("lists a record as stale when the native exception it matches is of a kind its run does not make coverable", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassInA],
        touched: nothingTouched,
        runs: [{ mechanism: audit, nativeExceptions: [expectationInA], coverableKinds: [] }],
      }).stale,
    ).toEqual([carvedNoClassInA]);
  });
});

describe("applyGovernance rule 5, unrecorded", () => {
  it("lists nothing when no run reports a native exception", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [],
        touched: nothingTouched,
        runs: [quietWalker, { mechanism: eslint, nativeExceptions: [], coverableKinds: [] }],
      }).unrecorded,
    ).toEqual([]);
  });

  it("records a native exception of a coverable kind that an authorised location naming its clause and file matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...locatedNoClassInA, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            coverableKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([]);
  });

  it("lists, attributed to its mechanism, a native exception of a kind its run does not make coverable", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...locatedNoClassInA, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [
              {
                kind: "inline-disable",
                clause: noClass,
                file: fileA,
                line: 7,
                text: "// eslint-disable-line no-class",
                reach: "one-clause",
              },
            ],
            coverableKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([
      {
        kind: "inline-disable",
        clause: noClass,
        file: fileA,
        line: 7,
        text: "// eslint-disable-line no-class",
        reach: "one-clause",
        mechanism: eslint,
      },
    ]);
  });

  it("lists a native exception of a coverable kind that no record matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            coverableKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileA, mechanism: eslint }]);
  });

  it("lists a native exception whose matching record names another file", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...locatedNoClassInA, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileB }],
            coverableKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileB, mechanism: eslint }]);
  });

  it("lists a native exception whose kind only another run makes coverable", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [],
            coverableKinds: ["config-override"],
          },
          {
            mechanism: audit,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            coverableKinds: [],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileA, mechanism: audit }]);
  });

  it("lists a native exception that only a forfeited file carve-out matches, since the forfeited record no longer holds it", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassInA, mechanism: eslint }],
        touched: fileATouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            coverableKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileA, mechanism: eslint }]);
  });

  it("records a native exception in any file that a clause-wide carve-out matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassEverywhere, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [
              {
                kind: "suppression-entry",
                clause: noClass,
                file: fileB,
                location: suppressions,
              },
            ],
            coverableKinds: ["suppression-entry"],
          },
        ],
      }).unrecorded,
    ).toEqual([]);
  });

  it("lists a command-line option that a file carve-out on its location matches, even where its run makes the kind coverable", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassInA, mechanism: eslint, file: packageJson }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [scriptRuleOff],
            coverableKinds: ["command-line-option"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ ...scriptRuleOff, mechanism: eslint }]);
  });

  it("lists a command-line option that a clause-wide carve-out matches, even where its run makes the kind coverable", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassEverywhere, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [scriptRuleOff],
            coverableKinds: ["command-line-option"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ ...scriptRuleOff, mechanism: eslint }]);
  });

  it("lists a native exception that hides no finding", () => {
    expect(
      applyGovernance({
        findings: [noClassInB],
        records: [],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "ignore", clause: noClass, file: fileA }],
            coverableKinds: [],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "ignore", clause: noClass, file: fileA, mechanism: eslint }]);
  });
});

describe("applyGovernance rule 5, inline disables a file record holds", () => {
  it("records an inline disable that a file carve-out on its clause and file holds", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassInA],
        touched: nothingTouched,
        runs: [inlineRun({ nativeExceptions: [expectationInA] })],
      }),
    ).toEqual(nothingGoverned);
  });

  it("records an inline disable that an authorised location on its clause and file holds", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [inlineRun({ nativeExceptions: [expectationInA] })],
      }),
    ).toEqual(nothingGoverned);
  });

  it("records an inline disable naming no rule once a file record holds it for each clause it escapes", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassInA, { ...carvedNoClassInA, clause: noForOf }],
        touched: nothingTouched,
        runs: [
          inlineRun({ nativeExceptions: [bareDisableInA, { ...bareDisableInA, clause: noForOf }] }),
        ],
      }).unrecorded,
    ).toEqual([]);
  });

  it("lists an inline disable naming no rule for each clause it escapes that no file record holds", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassInA],
        touched: nothingTouched,
        runs: [
          inlineRun({ nativeExceptions: [bareDisableInA, { ...bareDisableInA, clause: noForOf }] }),
        ],
      }).unrecorded,
    ).toEqual([{ ...bareDisableInA, clause: noForOf, mechanism: audit }]);
  });
});

describe("applyGovernance rule 5, inline disables no file record holds", () => {
  it("lists an inline disable that only a clause-wide carve-out matches, and lists that carve-out as stale", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassEverywhere],
        touched: nothingTouched,
        runs: [inlineRun({ nativeExceptions: [expectationInA] })],
      }),
    ).toEqual({
      ...nothingGoverned,
      stale: [carvedNoClassEverywhere],
      unrecorded: [{ ...expectationInA, mechanism: audit }],
    });
  });

  it("lists an inline disable whose file record names another file", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassInA, file: fileB }],
        touched: nothingTouched,
        runs: [inlineRun({ nativeExceptions: [expectationInA] })],
      }).unrecorded,
    ).toEqual([{ ...expectationInA, mechanism: audit }]);
  });

  it("lists an inline disable whose file record names another clause", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassInA, clause: noForOf }],
        touched: nothingTouched,
        runs: [inlineRun({ nativeExceptions: [expectationInA] })],
      }).unrecorded,
    ).toEqual([{ ...expectationInA, mechanism: audit }]);
  });
});

describe("applyGovernance rule 5, an inline disable added after adoption", () => {
  it("fails the run as unrecorded when the file has no record", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [],
        touched: fileATouched,
        runs: [inlineRun({ nativeExceptions: [expectationInA] })],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInA],
      unrecorded: [{ ...expectationInA, mechanism: audit }],
    });
  });

  it("fails the run as forfeited when the file is carved out, and lists every directive the forfeited carve-out held", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassInA],
        touched: fileATouched,
        runs: [inlineRun({ nativeExceptions: [expectationInA, { ...expectationInA, line: 9 }] })],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInA],
      forfeited: [carvedNoClassInA],
      unrecorded: [
        { ...expectationInA, mechanism: audit },
        { ...expectationInA, line: 9, mechanism: audit },
      ],
    });
  });
});

describe("applyGovernance rule 5, doubly held", () => {
  it("records a native exception whose clause and file a doubly-held pair names", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [
          { ...locatedNoClassInA, mechanism: eslint },
          { ...carvedNoClassInA, mechanism: eslint },
        ],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            coverableKinds: ["config-override"],
          },
        ],
      }),
    ).toEqual({
      ...nothingGoverned,
      doublyHeld: [{ clause: noClass, file: fileA, mechanism: eslint }],
    });
  });
});

describe("applyGovernance rule 5, mechanism", () => {
  it("lists a native exception whose only matching clause and file record belongs to another mechanism", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            coverableKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileA, mechanism: eslint }]);
  });
});

describe("applyGovernance order", () => {
  it("keeps stale records in the records' order", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoForOfInA, carvedNoClassEverywhere, locatedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).stale,
    ).toEqual([locatedNoForOfInA, carvedNoClassEverywhere, locatedNoClassInA]);
  });

  it("keeps forfeited records in the records' order", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedProbeNoClassInA, carvedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }).forfeited,
    ).toEqual([carvedProbeNoClassInA, carvedNoClassInA]);
  });

  it("keeps doubly-held pairs in the records' order", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [
          locatedNoForOfInA,
          { ...carvedNoClassInA, clause: noForOf },
          locatedNoClassInA,
          carvedNoClassInA,
        ],
        touched: nothingTouched,
        runs: [quietWalker],
      }).doublyHeld,
    ).toEqual([
      { clause: noForOf, file: fileA, mechanism: audit },
      { clause: noClass, file: fileA, mechanism: audit },
    ]);
  });

  it("keeps unrecorded native exceptions in the runs' order, then each run's own order", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [
              { kind: "ignore", clause: noClass, file: fileB },
              { kind: "ignore", clause: noClass, file: fileA },
            ],
            coverableKinds: [],
          },
          {
            mechanism: audit,
            nativeExceptions: [{ kind: "ignore", clause: noForOf, file: fileA }],
            coverableKinds: [],
          },
        ],
      }).unrecorded,
    ).toEqual([
      { kind: "ignore", clause: noClass, file: fileB, mechanism: eslint },
      { kind: "ignore", clause: noClass, file: fileA, mechanism: eslint },
      { kind: "ignore", clause: noForOf, file: fileA, mechanism: audit },
    ]);
  });
});

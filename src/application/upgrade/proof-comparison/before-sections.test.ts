import { describe, expect, it } from "vitest";
import type { AttributedNativeException, Finding } from "../../../domain/finding/governance.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { VersionOneWhyChain } from "../../../infrastructure/discipline-exceptions-folder/version-one-why-chain.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { answeredKeyOf, beforeSectionsOf, findingKeyOf, nativeKeyOf } from "./before-sections.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const LOOPS_CLAUSE = clauseAddressSchema.parse("CD-15#loops");

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const EMPTY_BEFORE: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

const LOOP_FINDING: Finding = { clause: LOOPS_CLAUSE, file: SRC_A, anchor: { line: 3, column: 1 }, snippet: "the loop line", mechanism: AUDIT };

const CARVE_OUT: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const CLAUSE_WIDE: ExceptionRecord = { kind: "clause-wide-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, reason: "generated", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN };

const COMMAND_LINE_OPTION: AttributedNativeException = {
  kind: "command-line-option",
  clause: LOOPS_CLAUSE,
  location: repoPathSchema.parse("package.json"),
  script: "lint",
  option: "--ignore-pattern",
  cause: { kind: "weakens-run" },
  mechanism: AUDIT,
};

describe("findingKeyOf", () => {
  it("names the clause, file and anchor", () => {
    expect(findingKeyOf({ finding: LOOP_FINDING, clauseText: "CD-15#loops" })).toBe("CD-15#loops src/a.ts 3:1");
  });
});

describe("answeredKeyOf", () => {
  it("names each answering kind once, sorted", () => {
    expect(answeredKeyOf({ findingKey: "k", kinds: ["debt", "authorised-location", "debt"] })).toBe("k answered by authorised-location,debt");
  });
});

describe("nativeKeyOf", () => {
  it("places a command-line option at its script and option", () => {
    expect(nativeKeyOf({ exception: COMMAND_LINE_OPTION })).toBe("audit command-line-option CD-15#loops package.json lint --ignore-pattern");
  });

  it("places an ignore at its file", () => {
    expect(nativeKeyOf({ exception: { kind: "ignore", clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT } })).toBe("audit ignore CD-15#loops src/a.ts");
  });
});

describe("beforeSectionsOf", () => {
  it("holds nothing but a passing verdict for a report that holds nothing", () => {
    expect(beforeSectionsOf({ report: EMPTY_BEFORE })).toEqual({
      excluded: [],
      findings: [],
      answered: [],
      unrecorded: [],
      misnamed: [],
      paid: [],
      stale: [],
      forfeited: [],
      "doubly-held": [],
      "invalid-records": [],
      uncovered: [],
      "not-adopted": [],
      "not-run": [],
      editions: [],
      unmeasured: [],
      "projection-problems": [],
      assessment: [],
      verdict: ["pass"],
    });
  });

  it("keys each section of a report, a clause-wide carve-out by its clause and version 1's kinds as version 2's", () => {
    expect(
      beforeSectionsOf({
        report: {
          ...EMPTY_BEFORE,
          excluded: [repoPathSchema.parse("generated")],
          findings: [LOOP_FINDING],
          exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }],
          unrecorded: [COMMAND_LINE_OPTION],
          stale: [CLAUSE_WIDE],
          forfeited: [CARVE_OUT],
          doublyHeld: [{ clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT }],
          uncovered: [LOOPS_CLAUSE, LOOPS_CLAUSE],
          notRun: [LOOPS_CLAUSE],
          projectionProblems: [{ scope: "slice", mechanism: AUDIT, state: "missing", slice: repoPathSchema.parse("packages/web") }],
          assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 1 }],
        },
      }),
    ).toEqual({
      excluded: ["generated"],
      findings: ["CD-15#loops src/a.ts 3:1"],
      answered: ["CD-15#loops src/a.ts 3:1 answered by debt"],
      unrecorded: ["audit command-line-option CD-15#loops package.json lint --ignore-pattern"],
      misnamed: [],
      paid: [],
      stale: ["CD-15#loops"],
      forfeited: ["src/a.ts"],
      "doubly-held": ["CD-15#loops src/a.ts audit"],
      "invalid-records": [],
      uncovered: ["CD-15#loops"],
      "not-adopted": [],
      "not-run": ["CD-15#loops"],
      editions: [],
      unmeasured: [],
      "projection-problems": ["slice audit missing packages/web"],
      assessment: ["forfeiture elsewhere"],
      verdict: ["fail"],
    });
  });
});

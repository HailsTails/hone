import { describe, expect, it } from "vitest";
import type { AttributedNativeException, Finding } from "../../finding/governance.ts";
import type { LegacyWhyChain, VersionOneWhyChain } from "./version-one-why-chain.ts";
import type { ExceptionRecord } from "./exception-record.ts";
import { UNMEASURED_EXCEPTION_BASELINE } from "./exception-baseline.ts";
import { paidDebtOf, type PaidDebtRequest } from "./paid-debt.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";

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

const LEGACY_WHY = {
  why: "why is the exception taken",
  because: "the matcher cannot express the tracker id",
  evidence: "tools/why-chain-check.ts:9",
};

const LEGACY_WHY_CHAIN: LegacyWhyChain = {
  whys: [LEGACY_WHY, LEGACY_WHY, LEGACY_WHY, LEGACY_WHY, LEGACY_WHY],
  rootCause: "the audit's matcher predates the tracker id format",
  owner: "capture 01a0b421",
};

const LOOPS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") };
const CASTS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") };
const AUDIT = "audit" as const;
const ESLINT = "eslint" as const;
const BASKET = repoPathOf("src/basket.ts");
const LEGACY = repoPathOf("src/legacy/report.ts");

const carveOut = (request: { readonly clause: Finding["clause"]; readonly file: Finding["file"] }): ExceptionRecord => ({
  kind: "file-carve-out",
  clause: request.clause,
  mechanism: ESLINT,
  file: request.file,
});

const findingAt = (request: { readonly clause: Finding["clause"]; readonly file: Finding["file"] }): Finding => ({
  clause: request.clause,
  mechanism: ESLINT,
  file: request.file,
  anchor: { line: 1, column: 0 },
  snippet: "const total = basket.total;",
});

const directiveAt = (request: { readonly clause: Finding["clause"]; readonly file: Finding["file"] }): AttributedNativeException => ({
  kind: "inline-disable",
  clause: request.clause,
  mechanism: ESLINT,
  file: request.file,
  line: 1,
  text: "// eslint-disable-next-line",
  reach: "one-clause",
});

const NOTHING: PaidDebtRequest = {
  findings: [],
  exempted: [],
  stale: [],
  forfeited: [],
  nativeExceptions: [],
  absent: [],
  excluded: [],
  measured: [],
  baseline: UNMEASURED_EXCEPTION_BASELINE,
};

const CHECKOUT = repoPathOf("src/checkout.ts");
const PRICES = repoPathOf("src/prices.ts");
const TOTALS = repoPathOf("src/totals.ts");
const PACKAGE_JSON = repoPathOf("package.json");

const GONE: PaidDebtRequest = { ...NOTHING, absent: [BASKET, LEGACY, CHECKOUT, PRICES, TOTALS] };

describe("paidDebtOf choosing stale records", () => {
  it("names each stale file carve-out, ordered by file and then clause", () => {
    expect(
      paidDebtOf({
        ...GONE,
        stale: [carveOut({ clause: LOOPS, file: LEGACY }), carveOut({ clause: CASTS, file: BASKET }), carveOut({ clause: LOOPS, file: BASKET })],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET },
      { clause: CASTS, file: BASKET },
      { clause: LOOPS, file: LEGACY },
    ]);
  });

  it("leaves a stale authorised location and a stale clause-wide carve-out to a person", () => {
    expect(
      paidDebtOf({
        ...GONE,
        stale: [
          { kind: "authorised-location", clause: LOOPS, mechanism: AUDIT, file: BASKET, reason: "the one loop over the clock" },
          { kind: "clause-wide-carve-out", clause: CASTS, mechanism: ESLINT, reason: "casts carved out during migration", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN },
        ],
      }),
    ).toEqual([]);
  });
});

describe("paidDebtOf choosing forfeited records by their own clause and file", () => {
  it("names a forfeited file carve-out whose clause and file hold no finding and no native exception", () => {
    expect(paidDebtOf({ ...GONE, forfeited: [carveOut({ clause: LOOPS, file: BASKET })] })).toEqual([{ clause: LOOPS, file: BASKET }]);
  });

  it("keeps a forfeited file carve-out whose clause and file still hold a finding", () => {
    expect(
      paidDebtOf({
        ...GONE,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        findings: [findingAt({ clause: LOOPS, file: BASKET })],
      }),
    ).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose clause and file hold a finding another record exempts", () => {
    expect(
      paidDebtOf({
        ...GONE,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        exempted: [{ finding: findingAt({ clause: LOOPS, file: BASKET }), by: [carveOut({ clause: LOOPS, file: BASKET })] }],
      }),
    ).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose clause and file hold an inline disable", () => {
    expect(
      paidDebtOf({
        ...GONE,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        nativeExceptions: [directiveAt({ clause: LOOPS, file: BASKET })],
      }),
    ).toEqual([]);
  });
});

describe("paidDebtOf naming forfeited records beside other entries", () => {
  it("names a forfeited file carve-out whose findings are all on another clause or another file", () => {
    expect(
      paidDebtOf({
        ...GONE,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        findings: [findingAt({ clause: CASTS, file: BASKET }), findingAt({ clause: LOOPS, file: LEGACY })],
      }),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });

  it("names a forfeited file carve-out whose file is held only by a script option, which names no file", () => {
    expect(
      paidDebtOf({
        ...GONE,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        nativeExceptions: [
          {
            kind: "command-line-option",
            clause: LOOPS,
            mechanism: ESLINT,
            location: PACKAGE_JSON,
            script: "lint",
            option: "--rule hone/no-for-of: off",
            cause: { kind: "weakens-run" },
          },
        ],
      }),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });

  it("names a pair once when it is both stale and forfeited", () => {
    expect(
      paidDebtOf({ ...GONE, stale: [carveOut({ clause: LOOPS, file: BASKET })], forfeited: [carveOut({ clause: LOOPS, file: BASKET })] }),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });
});

describe("paidDebtOf naming only debt on a file no longer on disk", () => {
  it("leaves a stale and a forfeited file carve-out on files that still exist, naming one on a file no longer on disk", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        stale: [carveOut({ clause: LOOPS, file: BASKET }), carveOut({ clause: LOOPS, file: CHECKOUT })],
        forfeited: [carveOut({ clause: LOOPS, file: LEGACY })],
        absent: [CHECKOUT],
      }),
    ).toEqual([{ clause: LOOPS, file: CHECKOUT }]);
  });

  it("keeps a stale file carve-out on a file no longer on disk whose clause and file hold an ignore", () => {
    expect(
      paidDebtOf({
        ...GONE,
        stale: [carveOut({ clause: LOOPS, file: BASKET })],
        nativeExceptions: [{ kind: "ignore", clause: LOOPS, mechanism: ESLINT, file: BASKET }],
      }),
    ).toEqual([]);
  });
});

describe("paidDebtOf naming debt on a file still on disk that its mechanism measured", () => {
  it("names a stale and a forfeited file carve-out whose clause was measured on its file, which is still on disk", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        stale: [carveOut({ clause: LOOPS, file: BASKET })],
        forfeited: [carveOut({ clause: CASTS, file: LEGACY })],
        measured: [
          { clause: LOOPS, file: BASKET },
          { clause: CASTS, file: LEGACY },
        ],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET },
      { clause: CASTS, file: LEGACY },
    ]);
  });

  it("leaves a stale file carve-out whose file was measured only on another clause", () => {
    expect(
      paidDebtOf({ ...NOTHING, stale: [carveOut({ clause: LOOPS, file: BASKET })], measured: [{ clause: CASTS, file: BASKET }] }),
    ).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose measured clause and file still hold a finding", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        findings: [findingAt({ clause: LOOPS, file: BASKET })],
        measured: [{ clause: LOOPS, file: BASKET }],
      }),
    ).toEqual([]);
  });

  it("keeps a stale file carve-out whose measured clause and file hold an ignore", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        stale: [carveOut({ clause: LOOPS, file: BASKET })],
        nativeExceptions: [{ kind: "ignore", clause: LOOPS, mechanism: ESLINT, file: BASKET }],
        measured: [{ clause: LOOPS, file: BASKET }],
      }),
    ).toEqual([]);
  });
});

const AUTHORISED_BASKET_LOOP: ExceptionRecord = {
  kind: "authorised-location",
  clause: LOOPS,
  mechanism: ESLINT,
  file: BASKET,
  reason: "the one loop over the clock",
};

const LOOPS_CLAUSE_WIDE: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: LOOPS,
  mechanism: ESLINT,
  reason: "loops carved out during migration",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

describe("paidDebtOf naming debt whose every finding an authorised location answers", () => {
  it("names a forfeited file carve-out on a measured pair whose only finding an authorised location in force exempts", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        exempted: [{ finding: findingAt({ clause: LOOPS, file: BASKET }), by: [AUTHORISED_BASKET_LOOP] }],
        measured: [{ clause: LOOPS, file: BASKET }],
      }),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });

  it("keeps a forfeited file carve-out whose finding an authorised location exempts when its pair was not measured", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        exempted: [{ finding: findingAt({ clause: LOOPS, file: BASKET }), by: [AUTHORISED_BASKET_LOOP] }],
      }),
    ).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose finding only a clause-wide carve-out exempts, since that is debt too", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        exempted: [{ finding: findingAt({ clause: LOOPS, file: BASKET }), by: [LOOPS_CLAUSE_WIDE] }],
        measured: [{ clause: LOOPS, file: BASKET }],
      }),
    ).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose pair holds one finding an authorised location exempts and one no record answers", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        exempted: [{ finding: findingAt({ clause: LOOPS, file: BASKET }), by: [AUTHORISED_BASKET_LOOP] }],
        findings: [findingAt({ clause: LOOPS, file: BASKET })],
        measured: [{ clause: LOOPS, file: BASKET }],
      }),
    ).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose finding an authorised location exempts while a native exception on its pair suppresses others", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        exempted: [{ finding: findingAt({ clause: LOOPS, file: BASKET }), by: [AUTHORISED_BASKET_LOOP] }],
        nativeExceptions: [directiveAt({ clause: LOOPS, file: BASKET })],
        measured: [{ clause: LOOPS, file: BASKET }],
      }),
    ).toEqual([]);
  });
});

const MEASURED_BASELINE: PaidDebtRequest["baseline"] = { measured: "yes", entriesAtBase: [], sourceTextsAtBase: new Map(), basePathOfRenamed: new Map() };

const IMPORTED_BASKET_LOOP: ExceptionRecord = {
  ...AUTHORISED_BASKET_LOOP,
  provenance: { kind: "existing-authorisation", source: ".constitution-authorised-locations/cd-15.json" },
};

const LEGACY_CHAIN_BASKET_LOOP: ExceptionRecord = { ...AUTHORISED_BASKET_LOOP, whyChain: LEGACY_WHY_CHAIN };

const forfeitedBasketAnsweredBy = (request: { readonly answer: ExceptionRecord; readonly baseline: PaidDebtRequest["baseline"] }): PaidDebtRequest => ({
  ...NOTHING,
  forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
  exempted: [{ finding: findingAt({ clause: LOOPS, file: BASKET }), by: [request.answer] }],
  measured: [{ clause: LOOPS, file: BASKET }],
  baseline: request.baseline,
});

describe("paidDebtOf naming answered debt only when the answer's standing was established in this run", () => {
  it("keeps a forfeited file carve-out whose finding an imported authorised location exempts while the records at the base revision went unread", () => {
    expect(paidDebtOf(forfeitedBasketAnsweredBy({ answer: IMPORTED_BASKET_LOOP, baseline: UNMEASURED_EXCEPTION_BASELINE }))).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose finding a legacy-chain authorised location exempts while the records at the base revision went unread", () => {
    expect(paidDebtOf(forfeitedBasketAnsweredBy({ answer: LEGACY_CHAIN_BASKET_LOOP, baseline: UNMEASURED_EXCEPTION_BASELINE }))).toEqual([]);
  });

  it("names a forfeited file carve-out whose finding an imported authorised location exempts once the base revision was read", () => {
    expect(paidDebtOf(forfeitedBasketAnsweredBy({ answer: IMPORTED_BASKET_LOOP, baseline: MEASURED_BASELINE }))).toEqual([{ clause: LOOPS, file: BASKET }]);
  });

  it("names a forfeited file carve-out whose finding a causal-chain authorised location exempts, which no base revision judges", () => {
    expect(
      paidDebtOf(forfeitedBasketAnsweredBy({ answer: { ...AUTHORISED_BASKET_LOOP, whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN }, baseline: UNMEASURED_EXCEPTION_BASELINE })),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });
});

describe("paidDebtOf keeping debt a native suppression on its pair may hide, recorded or not", () => {
  it("keeps a forfeited file carve-out on a measured pair whose rule a config override turns off, though a clause-wide carve-out records the override", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        nativeExceptions: [{ kind: "config-override", clause: LOOPS, mechanism: ESLINT, file: BASKET }],
        measured: [{ clause: LOOPS, file: BASKET }],
      }),
    ).toEqual([]);
  });
});

describe("paidDebtOf keeping a forfeited record each native exception on its file holds", () => {
  it("keeps a forfeited file carve-out held by an ignore, a config override, a suppression entry or an inline rule config on its clause and file", () => {
    expect(
      paidDebtOf({
        ...GONE,
        forfeited: [
          carveOut({ clause: LOOPS, file: BASKET }),
          carveOut({ clause: LOOPS, file: CHECKOUT }),
          carveOut({ clause: LOOPS, file: PRICES }),
          carveOut({ clause: LOOPS, file: TOTALS }),
        ],
        nativeExceptions: [
          { kind: "ignore", clause: LOOPS, mechanism: ESLINT, file: BASKET },
          { kind: "config-override", clause: LOOPS, mechanism: ESLINT, file: CHECKOUT },
          { kind: "suppression-entry", clause: LOOPS, mechanism: ESLINT, file: PRICES, location: repoPathOf("eslint-suppressions.json") },
          { kind: "inline-rule-config", clause: LOOPS, mechanism: ESLINT, file: TOTALS, line: 1, text: "/* eslint hone/no-for-of: off */" },
        ],
      }),
    ).toEqual([]);
  });
});

const VENDORED = repoPathOf("src/vendored");
const VENDORED_BASKET = repoPathOf("src/vendored/basket.ts");
const VENDORED_PRICES = repoPathOf("src/vendored/prices.ts");
const EXCLUDING_VENDORED: PaidDebtRequest = { ...NOTHING, excluded: [VENDORED] };

describe("paidDebtOf naming debt on a file the selection excludes", () => {
  it("names a stale and a forfeited file carve-out on files still on disk inside an excluded folder", () => {
    expect(
      paidDebtOf({
        ...EXCLUDING_VENDORED,
        stale: [carveOut({ clause: LOOPS, file: VENDORED_BASKET })],
        forfeited: [carveOut({ clause: CASTS, file: VENDORED_PRICES })],
      }),
    ).toEqual([
      { clause: LOOPS, file: VENDORED_BASKET },
      { clause: CASTS, file: VENDORED_PRICES },
    ]);
  });

  it("leaves a stale file carve-out on a file outside the excluded folder that its mechanism did not measure", () => {
    expect(paidDebtOf({ ...EXCLUDING_VENDORED, stale: [carveOut({ clause: LOOPS, file: BASKET })] })).toEqual([]);
  });
});

describe("paidDebtOf keeping debt on an excluded file whose pair is still held", () => {
  it.each<{ readonly name: string; readonly nativeException: AttributedNativeException }>([
    { name: "an ignore", nativeException: { kind: "ignore", clause: LOOPS, mechanism: ESLINT, file: VENDORED_BASKET } },
    { name: "an inline disable", nativeException: directiveAt({ clause: LOOPS, file: VENDORED_BASKET }) },
  ])("keeps a forfeited file carve-out on an excluded file whose clause and file hold $name", ({ nativeException }) => {
    expect(
      paidDebtOf({ ...EXCLUDING_VENDORED, forfeited: [carveOut({ clause: LOOPS, file: VENDORED_BASKET })], nativeExceptions: [nativeException] }),
    ).toEqual([]);
  });

  it("keeps a stale file carve-out on an excluded file whose clause and file hold an ignore", () => {
    expect(
      paidDebtOf({
        ...EXCLUDING_VENDORED,
        stale: [carveOut({ clause: LOOPS, file: VENDORED_BASKET })],
        nativeExceptions: [{ kind: "ignore", clause: LOOPS, mechanism: ESLINT, file: VENDORED_BASKET }],
      }),
    ).toEqual([]);
  });
});

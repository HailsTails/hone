import { describe, expect, it } from "vitest";
import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { VersionOneWhyChain } from "../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import type { HeadRecord } from "../../../domain/records/upgrade/head-records.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { FileCarveOutRecord } from "../../ports/upgrade/record-answer-oracle.ts";
import { recordInputsOf } from "./record-inputs.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";

const AUDIT = "audit" as const;

const LOOPS_CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") };

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: {
    name: "loop-keyword",
    title: "Loop keyword",
    seen: "`for` or `while`.",
    mayIndicate: [],
    breachUsuallySits: "in the unit",
    recipes: [],
    correctUses: [],
  },
  clause: LOOPS_CLAUSE,
  engines: [
    { name: "walker", mechanism: AUDIT },
    { name: "eslint", mechanism: "eslint" },
  ],
  forms: [],
};

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

const CARVE_OUT: FileCarveOutRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: repoPathOf("src/a.ts"), reason: "legacy loop" };

const AUTHORISED: Extract<ExceptionRecord, { readonly kind: "authorised-location" }> = {
  kind: "authorised-location",
  clause: LOOPS_CLAUSE,
  mechanism: AUDIT,
  file: repoPathOf("src/b.ts"),
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

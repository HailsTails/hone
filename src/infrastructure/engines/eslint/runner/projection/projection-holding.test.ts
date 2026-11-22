import { describe, expect, it } from "vitest";

import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { VersionOneWhyChain } from "../../../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { projectionHolding } from "./projection-holding.ts";

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

const CLASS_SYNTAX = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-syntax"),
};
const FOR_OF = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("no-for-of"),
};
const ESLINT = "eslint" as const;
const FACTORY = repoPathOf("src/factory.ts");
const OTHER_FILE = repoPathOf("src/a.ts");

const FACTORY_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source:
      "fictional unit fixture mechanisms/eslint/runner/projection-holding.test.ts#FACTORY_LOCATION; not historical authorisation",
  },
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: FACTORY,
  reason: "the wrapping factory for the library",
};

const FACTORY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: FACTORY,
  reason: "Inherited class awaiting paydown",
};

const CLAUSE_WIDE: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  reason: "Class syntax carved out during migration",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

describe("projectionHolding", () => {
  it("is projected-off for the file an authorised location names, on its clause", () => {
    expect(
      projectionHolding({ records: [FACTORY_LOCATION], clause: CLASS_SYNTAX, file: FACTORY }),
    ).toBe("projected-off");
  });

  it("is projected-off for the file a file carve-out names, on its clause", () => {
    expect(
      projectionHolding({ records: [FACTORY_CARVE_OUT], clause: CLASS_SYNTAX, file: FACTORY }),
    ).toBe("projected-off");
  });

  it("is projected-off for any file under a clause-wide carve-out on its clause", () => {
    expect(
      projectionHolding({ records: [CLAUSE_WIDE], clause: CLASS_SYNTAX, file: OTHER_FILE }),
    ).toBe("projected-off");
  });

  it("is not-held for a file no record names", () => {
    expect(
      projectionHolding({ records: [FACTORY_LOCATION], clause: CLASS_SYNTAX, file: OTHER_FILE }),
    ).toBe("not-held");
  });

  it("is not-held for a file whose record names another clause", () => {
    expect(projectionHolding({ records: [FACTORY_LOCATION], clause: FOR_OF, file: FACTORY })).toBe(
      "not-held",
    );
  });

  it("is not-held under a clause-wide carve-out on another clause", () => {
    expect(projectionHolding({ records: [CLAUSE_WIDE], clause: FOR_OF, file: FACTORY })).toBe(
      "not-held",
    );
  });

  it("is not-held when there are no records", () => {
    expect(projectionHolding({ records: [], clause: CLASS_SYNTAX, file: FACTORY })).toBe(
      "not-held",
    );
  });
});

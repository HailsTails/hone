import { describe, expect, it } from "vitest";

import type { ClauseChecks } from "../../domain/language-layer/clause-checks.ts";
import type { Check, Engine, Symptom } from "../../domain/language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import { carriedDebtDocumentsAtBaseOf } from "./carried-debt-at-base.ts";
import type { VersionOneEntry } from "./version-one-entries.ts";

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

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT],
  forms: [],
  findingSpecifics: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
  findingSpecifics: [],
};

const REBINDING_TEST_BODY: Check = {
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
  ["CD-27#test-body-logic", [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY]],
]);

const LOOP_KEYWORD_DEBT = repoPathOf("hone-records/debt/loop-keyword.json");

const REBINDING_DEBT = repoPathOf("hone-records/debt/rebinding.json");

const CARVE_OUT: VersionOneEntry = {
  kind: "file-carve-out",
  clause: "CD-15#loops",
  file: "src/a.ts",
  reason: "legacy loop",
  whyChain: ["a", "b", "c", "d", "e"],
};

const TEST_BODY_CARVE_OUT: VersionOneEntry = { ...CARVE_OUT, clause: "CD-27#test-body-logic" };

const documentsAtBase = (request: { readonly entries: readonly VersionOneEntry[] }) =>
  carriedDebtDocumentsAtBaseOf({ entries: request.entries, clauseChecks: CLAUSE_CHECKS });

describe("carriedDebtDocumentsAtBaseOf writing the debt the base's file carve-outs would have been carried as", () => {
  it("writes the debt at the one check of the clause, in that symptom's debt file, carrying the entry word for word", () => {
    expect(documentsAtBase({ entries: [CARVE_OUT] })).toEqual([
      {
        file: LOOP_KEYWORD_DEBT,
        document: {
          version: 2,
          records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: CARVE_OUT }],
        },
      },
    ]);
  });

  it("writes the debt at each check of a two-check clause, in the debt file of each check's symptom", () => {
    expect(documentsAtBase({ entries: [TEST_BODY_CARVE_OUT] })).toEqual([
      {
        file: LOOP_KEYWORD_DEBT,
        document: {
          version: 2,
          records: [
            { answers: "loop-keyword#test-body", file: "src/a.ts", carried: TEST_BODY_CARVE_OUT },
          ],
        },
      },
      {
        file: REBINDING_DEBT,
        document: {
          version: 2,
          records: [
            { answers: "rebinding#test-body", file: "src/a.ts", carried: TEST_BODY_CARVE_OUT },
          ],
        },
      },
    ]);
  });

  it("writes one document for the debts of the same symptom, in the order the entries were read", () => {
    const other: VersionOneEntry = { ...CARVE_OUT, file: "src/b.ts" };
    expect(documentsAtBase({ entries: [CARVE_OUT, other] })).toEqual([
      {
        file: LOOP_KEYWORD_DEBT,
        document: {
          version: 2,
          records: [
            { answers: "loop-keyword#loops", file: "src/a.ts", carried: CARVE_OUT },
            { answers: "loop-keyword#loops", file: "src/b.ts", carried: other },
          ],
        },
      },
    ]);
  });

  it("writes a team check's debt in its rule set's records folder", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const clause: ClauseAddress = { ...LOOPS_CLAUSE, ruleSet: acme };
    const symptom: Symptom = { ...LOOP_KEYWORD, ruleSet: acme };
    const check: Check = { ...LOOP_KEYWORD_LOOPS, symptom, clause };
    const entry: VersionOneEntry = { ...CARVE_OUT, clause: "acme/CD-15#loops" };
    expect(
      carriedDebtDocumentsAtBaseOf({
        entries: [entry],
        clauseChecks: new Map([["acme/CD-15#loops", [check]]]),
      }),
    ).toEqual([
      {
        file: "hone-records/acme/debt/loop-keyword.json",
        document: {
          version: 2,
          records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: entry }],
        },
      },
    ]);
  });

  it("writes nothing for an authorised location", () => {
    expect(
      documentsAtBase({
        entries: [
          { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" },
        ],
      }),
    ).toEqual([]);
  });

  it("writes nothing for a clause-wide carve-out", () => {
    expect(
      documentsAtBase({
        entries: [
          {
            kind: "clause-wide-carve-out",
            clause: "CD-15#loops",
            reason: "generated",
            whyChain: ["a"],
          },
        ],
      }),
    ).toEqual([]);
  });

  it("writes nothing for a carve-out whose clause has no check in the catalogue", () => {
    expect(documentsAtBase({ entries: [{ ...CARVE_OUT, clause: "CD-99#unknown" }] })).toEqual([]);
  });

  it("writes nothing for an entry whose clause or file does not parse", () => {
    expect(
      documentsAtBase({
        entries: [
          { ...CARVE_OUT, clause: "not a clause" },
          { ...CARVE_OUT, file: "/absolute.ts" },
        ],
      }),
    ).toEqual([]);
  });

  it("writes nothing when the base held no entries", () => {
    expect(documentsAtBase({ entries: [] })).toEqual([]);
  });
});

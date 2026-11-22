import { describe, expect, it } from "vitest";
import type { RunnerClause } from "./runner-module-types.ts";
import type { SourceCase } from "../rule-set/rule-set-types.ts";
import { editionRunsOf } from "./edition-runs.ts";
import { repoPathOf } from "../repository/repo-path-of.ts";
import { editionOf } from "../rule-set/edition-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";

const CLAUSE: RunnerClause = {
  address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") },
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-27",
  settings: { module: "test-body-logic.ts" },
  clauseSettings: {},
  edition: editionOf("1"),
};
const SECOND = editionOf("2");
const UNSTATED: SourceCase = { name: "if statement", fileName: repoPathOf("a.test.ts"), source: "if (x) {}\n", expectedLines: [1] };
const FIRST: SourceCase = { name: "plain", fileName: repoPathOf("b.test.ts"), source: "expect(1).toBe(1);\n", expectedLines: [], edition: editionOf("1") };
const LATER: SourceCase = { name: "nullish", fileName: repoPathOf("c.test.ts"), source: "a ?? b;\n", expectedLines: [1], edition: SECOND };

describe("editionRunsOf", () => {
  it("runs every case under the clause's own edition when no case names another", () => {
    expect(editionRunsOf({ clause: CLAUSE, cases: [UNSTATED, FIRST] })).toEqual([{ clause: CLAUSE, cases: [UNSTATED, FIRST] }]);
  });

  it("runs each named edition's cases apart, the clause's own edition first", () => {
    expect(editionRunsOf({ clause: CLAUSE, cases: [LATER, UNSTATED, FIRST] })).toEqual([
      { clause: CLAUSE, cases: [UNSTATED, FIRST] },
      { clause: { ...CLAUSE, edition: "2" }, cases: [LATER] },
    ]);
  });

  it("runs nothing under the clause's own edition when every case names another", () => {
    expect(editionRunsOf({ clause: CLAUSE, cases: [LATER] })).toEqual([{ clause: { ...CLAUSE, edition: "2" }, cases: [LATER] }]);
  });
});

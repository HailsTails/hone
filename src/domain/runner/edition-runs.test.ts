import { describe, expect, it } from "vitest";
import type { RunnerClause } from "./runner-module-types.ts";
import type { SourceCase } from "../rule-set/rule-set-types.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { editionSchema, FIRST_EDITION } from "../../infrastructure/content-files/edition.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { editionRunsOf } from "./edition-runs.ts";

const CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-27#test-body-logic"),
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-27",
  settings: { module: "test-body-logic.ts" },
  clauseSettings: {},
  edition: FIRST_EDITION,
};
const SECOND = editionSchema.parse("2");
const UNSTATED: SourceCase = { name: "if statement", fileName: repoPathSchema.parse("a.test.ts"), source: "if (x) {}\n", expectedLines: [1] };
const FIRST: SourceCase = { name: "plain", fileName: repoPathSchema.parse("b.test.ts"), source: "expect(1).toBe(1);\n", expectedLines: [], edition: FIRST_EDITION };
const LATER: SourceCase = { name: "nullish", fileName: repoPathSchema.parse("c.test.ts"), source: "a ?? b;\n", expectedLines: [1], edition: SECOND };

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

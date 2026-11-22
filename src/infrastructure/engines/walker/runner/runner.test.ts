import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import { runnerModuleSchema } from "../../protocol/runner-module/runner-module-schema.ts";
import { runner } from "./runner.ts";

describe("runner", () => {
  it("is a standalone runner module core accepts", () => {
    expect(runnerModuleSchema.safeParse(runner)).toMatchObject({
      success: true,
      data: { exceptionPath: "standalone" },
    });
  });

  it("refuses a clause whose settings name a module outside the piece folder before loading anything", async () => {
    expect(
      await runner.conform({
        clause: {
          address: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("XX-1"),
            clause: clauseIdOf("first-check"),
          },
          anchor: { kind: "file" },
          pieceRoot: "/install/mechanisms/audit/XX-1",
          clauseSettings: {},
          edition: editionOf("1"),
          settings: { module: "../x.ts" },
        },
        cases: [
          {
            name: "one line",
            fileName: repoPathOf("src/a.ts"),
            source: "const a = 1;\n",
            expectedLines: [],
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: "/install/mechanisms/audit/XX-1",
        detail: expect.any(String),
      },
    });
  });
});

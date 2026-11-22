import { describe, expect, it } from "vitest";
import { checksRunnerModuleSchema } from "../../protocol/checks/checks-runner-module-schema.ts";
import { runnerModuleSchema } from "../../protocol/runner-module/runner-module-schema.ts";
import { checksRunner, runner } from "./runner.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";

describe("runner", () => {
  it("is an embedded runner module core accepts, projecting config overrides and inline disables", () => {
    expect(runnerModuleSchema.safeParse(runner)).toMatchObject({
      success: true,
      data: { exceptionPath: "embedded", projectedKinds: ["config-override", "inline-disable"] },
    });
  });

  it("exports a checks runner module core accepts, projecting config overrides and inline disables", () => {
    expect(checksRunnerModuleSchema.safeParse(checksRunner)).toMatchObject({
      success: true,
      data: { projectedKinds: ["config-override", "inline-disable"] },
    });
  });

  it("refuses a clause whose settings name a plugin module outside the piece folder before loading anything", async () => {
    expect(
      await runner.conform({
        clause: {
          address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("XX-1"), clause: clauseIdOf("first-check") },
          anchor: { kind: "file" },
          pieceRoot: "/install/mechanisms/eslint/XX-1",
          clauseSettings: {},
          edition: editionOf("1"),
          settings: { pluginNamespace: "xx", pluginModule: "../x.ts", rule: "first-check" },
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
        pieceRoot: "/install/mechanisms/eslint/XX-1",
        detail: expect.any(String),
      },
    });
  });
});

import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import { namedChecksRunnerModuleSchema } from "../../protocol/checks/checks-runner-module-schema.ts";
import * as runnerModule from "./runner.ts";

const { namedChecksRunner } = runnerModule;

describe("runner", () => {
  it("exposes the named runner and the two upgrade projection operations", () => {
    expect(Object.keys(runnerModule).sort()).toEqual([
      "measureVersionOne",
      "namedChecksRunner",
      "versionOneProjectionOver",
    ]);
  });

  it("exports a checks runner module core accepts, projecting config overrides and inline disables", () => {
    expect(namedChecksRunnerModuleSchema.safeParse(namedChecksRunner)).toMatchObject({
      success: true,
      data: { fileScope: "typescript", projectedKinds: ["config-override", "inline-disable"] },
    });
  });

  it("refuses a check whose settings name a plugin module outside the piece folder before loading anything", async () => {
    expect(
      await namedChecksRunner.conform({
        binding: {
          address: "first-symptom#first-check",
          ruleSet: "hone",
          engine: "eslint",
          anchor: { kind: "file" },
          pieceRoot: "/install/checks/eslint/first-symptom/first-check",
          checkSettings: {},
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
        pieceRoot: "/install/checks/eslint/first-symptom/first-check",
        detail: expect.any(String),
      },
    });
  });
});

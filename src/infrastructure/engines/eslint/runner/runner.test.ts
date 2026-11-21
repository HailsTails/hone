import { describe, expect, it } from "vitest";
import { checksRunnerModuleSchema } from "../../protocol/checks/checks-runner-module-schema.ts";
import { runnerModuleSchema } from "../../protocol/runner-module/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { checksRunner, runner } from "./runner.ts";
import { FIRST_EDITION } from "../../../content-files/edition.ts";

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
          address: clauseAddressSchema.parse("XX-1#first-check"),
          anchor: { kind: "file" },
          pieceRoot: "/install/mechanisms/eslint/XX-1",
          clauseSettings: {},
          edition: FIRST_EDITION,
          settings: { pluginNamespace: "xx", pluginModule: "../x.ts", rule: "first-check" },
        },
        cases: [
          {
            name: "one line",
            fileName: repoPathSchema.parse("src/a.ts"),
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

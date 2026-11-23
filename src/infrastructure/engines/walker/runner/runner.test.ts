import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import { namedChecksRunnerModuleSchema } from "../../protocol/checks/checks-runner-module-schema.ts";
import { namedChecksRunner } from "./runner.ts";

describe("runner", () => {
  it("is a named runner module core accepts", () => {
    expect(namedChecksRunnerModuleSchema.safeParse(namedChecksRunner)).toMatchObject({
      success: true,
      data: { projectedKinds: ["inline-disable"] },
    });
  });

  it("refuses a clause whose settings name a module outside the piece folder before loading anything", async () => {
    expect(
      await namedChecksRunner.conform({
        binding: {
          address: "example#first-check",
          engine: "walker",
          anchor: { kind: "file" },
          pieceRoot: "/install/mechanisms/audit/XX-1",
          checkSettings: {},
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

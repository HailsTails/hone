import { describe, expect, it } from "vitest";
import { runnerModuleSchema } from "../../protocol/runner-module/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { runner } from "./runner.ts";
import { FIRST_EDITION } from "../../../content-files/edition.ts";

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
          address: clauseAddressSchema.parse("XX-1#first-check"),
          anchor: { kind: "file" },
          pieceRoot: "/install/mechanisms/audit/XX-1",
          clauseSettings: {},
          edition: FIRST_EDITION,
          settings: { module: "../x.ts" },
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
        pieceRoot: "/install/mechanisms/audit/XX-1",
        detail: expect.any(String),
      },
    });
  });
});

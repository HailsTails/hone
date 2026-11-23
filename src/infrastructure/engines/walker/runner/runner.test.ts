import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import { namedChecksRunnerModuleSchema } from "../../protocol/checks/checks-runner-module-schema.ts";
import { importsRewriterOf, namedChecksRunner } from "./runner.ts";

describe("runner", () => {
  it("hands the upgrade an import rewriter over the TypeScript it loads", async () => {
    const rewriter = await importsRewriterOf();
    assert(rewriter.outcome === "ok");
    expect(
      rewriter.value({
        text: 'import { names } from "./names.ts";\n',
        file: repoPathOf("acme/mechanisms/audit/ACME-1/scratch.ts"),
        movedTo: repoPathOf("acme/engines/walker/scratch-file/scratch-files/scratch.ts"),
        folder: repoPathOf("acme/mechanisms/audit/ACME-1"),
        moved: new Map([
          [
            repoPathOf("acme/mechanisms/audit/ACME-1/names.ts"),
            repoPathOf("acme/engines/walker/scratch-file/draft-files/names.ts"),
          ],
        ]),
      }),
    ).toEqual({ outcome: "ok", value: 'import { names } from "../draft-files/names.ts";\n' });
  });

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
          ruleSet: "hone",
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

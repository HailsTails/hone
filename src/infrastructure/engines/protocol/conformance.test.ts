import { describe, expect, it, vi } from "vitest";

import type { ParsedNamedRunner } from "../../../application/ports/engine/engine-run.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import type { SourceCase } from "../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import { namedCheckConformance } from "./conformance.ts";

const CLASS_BINDING: CheckBinding = {
  address: "authored-class-or-this#class-keyword",
  engine: "walker",
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/walker/authored-class-or-this/class-keyword",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "class-syntax.ts" },
};

const CLASS_ON_LINES_1_AND_3: SourceCase = {
  name: "two classes",
  fileName: repoPathOf("src/two-classes.ts"),
  source: "class A {}\nconst b = 1;\nclass C {}\n",
  expectedLines: [1, 3],
};

const NO_CLASS: SourceCase = {
  name: "no class",
  fileName: repoPathOf("src/no-class.ts"),
  source: "const b = 1;\n",
  expectedLines: [],
};

const CASES: readonly SourceCase[] = [CLASS_ON_LINES_1_AND_3, NO_CLASS];

const conformingWith = (returned: unknown): ParsedNamedRunner => ({
  fileScope: "tracked",
  projectedKinds: [],
  project: vi.fn(),
  run: vi.fn<ParsedNamedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  conform: vi.fn<ParsedNamedRunner["conform"]>().mockResolvedValue(returned),
});

const conformanceOf = (request: { readonly runner: ParsedNamedRunner }) =>
  namedCheckConformance({ binding: CLASS_BINDING, cases: CASES, runner: request.runner });

describe("namedCheckConformance", () => {
  it("has no failures when every case's flagged lines equal its expected lines", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3] },
            { caseName: "no class", flaggedLines: [] },
          ],
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("calls conform once with the check binding and cases and never calls run", async () => {
    const runner = conformingWith({
      outcome: "ok",
      value: [
        { caseName: "two classes", flaggedLines: [1, 3] },
        { caseName: "no class", flaggedLines: [] },
      ],
    });
    const conformance = await conformanceOf({ runner });
    expect({
      conformance,
      conformCalls: vi.mocked(runner.conform).mock.calls,
      runCalls: vi.mocked(runner.run).mock.calls,
    }).toEqual({
      conformance: { outcome: "ok", value: [] },
      conformCalls: [[{ binding: CLASS_BINDING, cases: CASES }]],
      runCalls: [],
    });
  });

  it("compares flagged lines as a set, ignoring their order", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "no class", flaggedLines: [] },
            { caseName: "two classes", flaggedLines: [3, 1] },
          ],
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("compares flagged lines as a set, tolerating a line flagged twice", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3, 3] },
            { caseName: "no class", flaggedLines: [] },
          ],
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("reports a case whose flagged lines miss an expected line", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1] },
            { caseName: "no class", flaggedLines: [] },
          ],
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          check: CLASS_BINDING.address,
          caseName: "two classes",
          expectedLines: [1, 3],
          flaggedLines: [1],
        },
      ],
    });
  });

  it("reports an allow case whose runner flagged a line", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3] },
            { caseName: "no class", flaggedLines: [1] },
          ],
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          check: CLASS_BINDING.address,
          caseName: "no class",
          expectedLines: [],
          flaggedLines: [1],
        },
      ],
    });
  });

  it("reports a failing case's expected and flagged lines as sorted, de-duplicated sets", async () => {
    await expect(
      namedCheckConformance({
        binding: CLASS_BINDING,
        cases: [{ ...CLASS_ON_LINES_1_AND_3, expectedLines: [3, 1, 3] }],
        runner: conformingWith({
          outcome: "ok",
          value: [{ caseName: "two classes", flaggedLines: [5, 1, 5, 2] }],
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          check: CLASS_BINDING.address,
          caseName: "two classes",
          expectedLines: [1, 3],
          flaggedLines: [1, 2, 5],
        },
      ],
    });
  });

  it("is runner-invalid-output when the verdicts miss a case", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [{ caseName: "two classes", flaggedLines: [1, 3] }],
        }),
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail: expect.stringContaining("case no class has no single verdict"),
      },
    });
  });

  it("is runner-invalid-output when two verdicts name the same case", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3] },
            { caseName: "no class", flaggedLines: [] },
            { caseName: "two classes", flaggedLines: [1, 3] },
          ],
        }),
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail: expect.stringContaining("case two classes has no single verdict"),
      },
    });
  });

  it("is runner-invalid-output when a verdict names an unknown case", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3] },
            { caseName: "no class", flaggedLines: [] },
            { caseName: "three classes", flaggedLines: [1] },
          ],
        }),
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail: expect.stringContaining("a verdict names the unknown case three classes"),
      },
    });
  });

  it("is runner-invalid-output when a verdict flags line 0", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [0, 1, 3] },
            { caseName: "no class", flaggedLines: [] },
          ],
        }),
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail: expect.stringContaining("→ at value[0].flaggedLines[0]"),
      },
    });
  });

  it("is runner-invalid-output when conform throws synchronously", async () => {
    const runner: ParsedNamedRunner = {
      ...conformingWith({ outcome: "ok", value: [] }),
      conform: vi.fn<ParsedNamedRunner["conform"]>().mockThrow(new Error("the runner threw")),
    };
    await expect(conformanceOf({ runner })).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail: expect.stringContaining("the runner call threw or rejected: the runner threw"),
      },
    });
  });

  it("is runner-invalid-output when conform rejects", async () => {
    const runner: ParsedNamedRunner = {
      ...conformingWith({ outcome: "ok", value: [] }),
      conform: vi
        .fn<ParsedNamedRunner["conform"]>()
        .mockRejectedValue(new Error("the runner rejected")),
    };
    await expect(conformanceOf({ runner })).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail: expect.stringContaining("the runner call threw or rejected: the runner rejected"),
      },
    });
  });

  it("passes the runner's own failure through unchanged", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "failed",
          error: {
            kind: "piece-invalid",
            pieceRoot: "/install/walker/authored-class-or-this/class-keyword",
            detail: "no check export",
          },
        }),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: "/install/walker/authored-class-or-this/class-keyword",
        detail: "no check export",
      },
    });
  });
});

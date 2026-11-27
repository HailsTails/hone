import { describe, expect, it } from "vitest";

import { runOxlint } from "./oxlint-port.ts";

const cli = `${import.meta.dirname}/../../../../../../node_modules/oxlint/bin/oxlint`;

describe("runOxlint", () => {
  it("maps native diagnostics to the source and preserves columns when disables are present", async () => {
    const sources = [
      { fileName: "src/value.ts", source: "const label = 'oxlint-disable';\n" },
      {
        fileName: "src/value.ts",
        source:
          "// eslint-disable-next-line @typescript-eslint/no-explicit-any\nconst café: any = 1;\n/* oxlint-disable */ const value: any = 2;",
      },
      { fileName: "src/value.mts", source: "export const value: unknown = 1;" },
    ];

    const sites = await runOxlint({
      cli,
      resolveFrom: import.meta.dirname,
      rules: [{ kind: "native", id: "typescript/no-explicit-any", options: [] }],
      sources,
    });

    expect(sites).toEqual({
      outcome: "ok",
      value: [
        { rule: "typescript/no-explicit-any", index: 1, line: 2, column: 13 },
        { rule: "typescript/no-explicit-any", index: 1, line: 3, column: 35 },
      ],
    });
  });

  it("counts a void this parameter and distinguishes rebinding from a property assignment", async () => {
    const sources = [
      {
        fileName: "src/change.ts",
        source: "function change(this: void, a: number, b: number) {\n  a++;\n  return a + b;\n}\n",
      },
      {
        fileName: "src/set.ts",
        source: "function set(item: { value: number }) { item.value = 1; }",
      },
    ];

    const sites = await runOxlint({
      cli,
      resolveFrom: import.meta.dirname,
      rules: [
        { kind: "native", id: "eslint/max-params", options: [{ max: 2, countVoidThis: true }] },
        { kind: "native", id: "eslint/no-param-reassign", options: [{ props: false }] },
      ],
      sources,
    });

    expect(sites).toEqual({
      outcome: "ok",
      value: [
        { rule: "eslint/max-params", index: 0, line: 1, column: 16 },
        { rule: "eslint/no-param-reassign", index: 0, line: 2, column: 3 },
      ],
    });
  });

  it("preserves distinct source basenames for filename-sensitive plugins", async () => {
    const sites = await runOxlint({
      cli,
      resolveFrom: import.meta.dirname,
      rules: [
        {
          kind: "plugin",
          namespace: "hone-filename",
          id: "hone-filename/filename-case",
          module: `${import.meta.dirname}/../../name-off-its-casing/filename-case/oxlint-plugin.ts`,
          options: [],
        },
      ],
      sources: [
        { fileName: "one/Bad_Name.ts", source: "const answer = 42;" },
        { fileName: "two/good-name.ts", source: "const answer = 42;" },
      ],
    });

    expect(sites).toEqual({
      outcome: "ok",
      value: [{ rule: "hone-filename/filename-case", index: 0, line: 1, column: 1 }],
    });
  });

  it("registers a shared plugin once when two selected checks use it", async () => {
    const module = `${import.meta.dirname}/../../test-switched-off/focused-tests/oxlint-plugin.ts`;
    const namespace = "hone-test-modifiers";
    const sites = await runOxlint({
      cli,
      resolveFrom: import.meta.dirname,
      rules: [
        { kind: "plugin", namespace, module, id: "hone-test-modifiers/focused-tests", options: [] },
        {
          kind: "plugin",
          namespace,
          module,
          id: "hone-test-modifiers/skipped-tests",
          options: ["conditional-and-todo"],
        },
      ],
      sources: [
        {
          fileName: "src/cache.test.ts",
          source: "test.only('run', () => {});\ntest.todo('later');",
        },
      ],
    });

    expect(sites).toEqual({
      outcome: "ok",
      value: [
        { rule: "hone-test-modifiers/focused-tests", index: 0, line: 1, column: 6 },
        { rule: "hone-test-modifiers/skipped-tests", index: 0, line: 2, column: 6 },
      ],
    });
  });

  it("refuses parser diagnostics", async () => {
    const sites = await runOxlint({
      cli,
      resolveFrom: import.meta.dirname,
      rules: [{ kind: "native", id: "typescript/no-explicit-any", options: [] }],
      sources: [{ fileName: "src/value.ts", source: "const =;" }],
    });

    expect(sites).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });
});

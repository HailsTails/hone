import { describe, expect, it } from "vitest";

import { runOxlint } from "./oxlint-port.ts";

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
      resolveFrom: import.meta.dirname,
      rules: ["typescript/no-explicit-any"],
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
      resolveFrom: import.meta.dirname,
      rules: ["eslint/max-params", "eslint/no-param-reassign"],
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

  it("refuses parser diagnostics", async () => {
    const sites = await runOxlint({
      resolveFrom: import.meta.dirname,
      rules: ["typescript/no-explicit-any"],
      sources: [{ fileName: "src/value.ts", source: "const =;" }],
    });

    expect(sites).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });
});

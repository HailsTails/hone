import { describe, expect, it } from "vitest";

import { mapDiagnosticsToSites } from "./oxlint-diagnostics.ts";

describe("mapDiagnosticsToSites", () => {
  it("maps byte offsets to source columns", () => {
    const sites = mapDiagnosticsToSites({
      diagnostics: [
        {
          filename: "sources/0/value.ts",
          message: "Unexpected any",
          code: "typescript(no-explicit-any)",
          labels: [{ span: { offset: 13, line: 1, length: 3 } }],
        },
      ],
      files: ["sources/0/value.ts"],
      sources: [{ fileName: "src/value.ts", source: "const café: any = 1;" }],
      rules: ["typescript/no-explicit-any"],
    });

    expect(sites).toEqual([{ rule: "typescript/no-explicit-any", index: 0, line: 1, column: 13 }]);
  });
});

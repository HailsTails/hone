import { describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import {
  mapDiagnosticsToSites,
  readOxlintDiagnostics,
  runOxlintProcess,
} from "./oxlint-diagnostics.ts";

describe("runOxlintProcess", () => {
  it("measures the named file with the explicitly selected configuration", () => {
    const folder = absolutePathSchema.parse(import.meta.dirname);
    const cli = `${import.meta.dirname}/../../../../../../node_modules/oxlint/bin/oxlint`;

    const diagnostics = runOxlintProcess({
      cli,
      folder,
      config: "disable-inspection.json",
      targets: ["oxlint-diagnostics.ts"],
      files: ["oxlint-diagnostics.ts"],
      rules: 0,
      options: [],
    });

    expect(diagnostics).toEqual([]);
  });
});

describe("readOxlintDiagnostics", () => {
  it("keeps the tool's explanation when plugin setup fails before JSON output", () => {
    const output = "Failed to setup JS plugin options:\nRule does not accept options";

    const read = () => readOxlintDiagnostics(output);

    expect(read).toThrow(output);
  });
});

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

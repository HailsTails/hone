import { describe, expect, it } from "vitest";

import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { findImportsOutside, listBoundaryFiles } from "./import-confinement.ts";

describe("findImportsOutside", () => {
  it("lists each import no allowance of its file's boundary allows, in boundary and source order", () => {
    const outside = findImportsOutside({
      sources: [
        {
          file: "src/a.ts",
          imports: [
            { specifier: "zod", kind: "import", form: "value", names: ["z"] },
            { specifier: "typescript", kind: "import", form: "value", names: ["ts"] },
          ],
        },
        {
          file: "src/b.test.ts",
          imports: [{ specifier: "vitest", kind: "import", form: "value", names: ["it"] }],
        },
        {
          file: "docs/c.ts",
          imports: [{ specifier: "left-pad", kind: "re-export", form: "type-only", names: ["*"] }],
        },
      ],
      boundaries: [
        {
          name: "sources",
          holds: [/^src\//, /^docs\//],
          leavesOut: [/\.test\.ts$/],
          allowed: [{ kind: "specifier", specifier: /^zod$/, forms: ["value"] }],
        },
        { name: "tests", holds: [/\.test\.ts$/], leavesOut: [], allowed: [] },
      ],
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
    });

    expect(outside).toEqual([
      {
        boundary: "sources",
        file: "src/a.ts",
        specifier: "typescript",
        kind: "import",
        form: "value",
        names: ["ts"],
      },
      {
        boundary: "sources",
        file: "docs/c.ts",
        specifier: "left-pad",
        kind: "re-export",
        form: "type-only",
        names: ["*"],
      },
      {
        boundary: "tests",
        file: "src/b.test.ts",
        specifier: "vitest",
        kind: "import",
        form: "value",
        names: ["it"],
      },
    ]);
  });
});

describe("listBoundaryFiles", () => {
  it("lists the files each boundary holds, a boundary holding none included", () => {
    const files = listBoundaryFiles({
      sources: [
        { file: "src/a.ts", imports: [] },
        { file: "src/a.test.ts", imports: [] },
        { file: "docs/b.ts", imports: [] },
      ],
      boundaries: [
        { name: "sources", holds: [/^src\//], leavesOut: [/\.test\.ts$/], allowed: [] },
        { name: "commands", holds: [/^commands\//], leavesOut: [], allowed: [] },
      ],
    });

    expect(files).toEqual([
      { boundary: "sources", files: ["src/a.ts"] },
      { boundary: "commands", files: [] },
    ]);
  });
});

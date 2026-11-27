import { assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { ESLINT_MAJOR_BOUNDARIES } from "./eslint-major-boundaries.ts";
import { findImportsOutside, listBoundaryFiles } from "./import-confinement.ts";
import { readRepositoryImports } from "./source-imports.ts";

const ESLINT_MAJOR_IMPORTS = [
  {
    boundary: "no ESLint major",
    file: "src/infrastructure/engines/eslint/runner/pieces/native-rules.ts",
    specifier: "eslint/use-at-your-own-risk",
    kind: "import",
    form: "value",
    names: ["builtinRules"],
  },
  {
    boundary: "no ESLint major",
    file: "src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts",
    specifier: "eslint-9",
    kind: "import",
    form: "value",
    names: ["* as eslint9"],
  },
  {
    boundary: "no ESLint major",
    file: "src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts",
    specifier: "eslint-9/use-at-your-own-risk",
    kind: "import",
    form: "value",
    names: ["builtinRules"],
  },
  {
    boundary: "no ESLint major",
    file: "src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts",
    specifier: "eslint",
    kind: "import",
    form: "type-only",
    names: ["ESLint"],
  },
  {
    boundary: "no ESLint major",
    file: "src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts",
    specifier: "eslint",
    kind: "re-export",
    form: "type-only",
    names: ["AST", "Rule", "SourceCode"],
  },
  {
    boundary: "no ESLint major",
    file: "src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts",
    specifier: "eslint",
    kind: "load",
    form: "dynamic",
    names: [],
  },
];

describe("where this repository's source files import an ESLint major", () => {
  it("is looked for in the known files, the boundary of each major included", async () => {
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", ".."] }),
    );
    const sources = await readRepositoryImports({ repoRoot });
    assert(sources.outcome === "ok", "the repository's source files read");

    const files = listBoundaryFiles({
      sources: sources.value,
      boundaries: ESLINT_MAJOR_BOUNDARIES,
    });

    expect(files).toEqual([
      {
        boundary: "no ESLint major",
        files: expect.arrayContaining([
          "src/infrastructure/engines/eslint/runner/toolchain/eslint-10/eslint-10-boundary.ts",
          "src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-boundary.ts",
          "src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts",
        ]),
      },
    ]);
  });

  it("is these places alone, a list that can only shrink, neither major's boundary among them", async () => {
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", ".."] }),
    );
    const sources = await readRepositoryImports({ repoRoot });
    assert(sources.outcome === "ok", "the repository's source files read");

    const outside = findImportsOutside({
      sources: sources.value,
      boundaries: ESLINT_MAJOR_BOUNDARIES,
      path,
    });

    expect(outside).toEqual(ESLINT_MAJOR_IMPORTS);
  });
});

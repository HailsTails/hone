import { assert, describe, expect, it } from "vitest";

import { PLUGIN_SPECIFIERS } from "../../src/application/upgrade/patching/version-one-plugin-specifiers.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { packagePlanOf } from "./building/package-plan.ts";

const PACKAGE = "@hailstails/hone";
const ESLINT = "src/infrastructure/engines/eslint";
const SHARED = "src/infrastructure/engines/protocol/plugin-rules";
const fileText = createDefaultFileTextPort({});
const path = createDefaultPathPort({});
const repositoryFile = (relativePath: string): string =>
  path.join({ segments: [import.meta.dirname, "../..", relativePath] });

describe("the package specifiers written by the version 1 upgrade", () => {
  it.each([
    { discipline: 1, folder: "untyped-value/explicit-any" },
    { discipline: 2, folder: "claimed-type/non-null-assertions" },
    { discipline: 6, folder: "name-off-its-casing/naming-convention" },
    { discipline: 14, folder: "authored-class-or-this/class-keyword" },
    { discipline: 40, folder: "positional-parameters/parameter-count" },
    { discipline: 44, folder: "rebinding/parameter-reassignment" },
  ])("ships the local implementation for $folder", ({ discipline, folder }) => {
    const piece = `${ESLINT}/${folder}/piece.json`;
    const source = `${ESLINT}/${folder}/eslint-plugin.ts`;
    const module = `${ESLINT}/${folder}/eslint-plugin.js`;
    const versionOne = `${PACKAGE}/mechanisms/eslint/CD-${discipline}/cd${discipline}/cd${discipline}.eslint-plugin.js`;
    const installed = fileText.read({ path: repositoryFile(piece) });
    assert(installed.outcome === "ok");

    const plan = packagePlanOf({
      sourcePaths: [piece, source],
      pieces: [{ path: piece, text: installed.value }],
    });
    const implementation = fileText.exists({ path: repositoryFile(source) });

    expect(PLUGIN_SPECIFIERS).toContainEqual({ versionOne, versionTwo: `${PACKAGE}/${module}` });
    expect(plan).toMatchObject({ outcome: "ok", value: { exported: [module] } });
    expect(implementation).toBe("present");
  });

  it.each([
    { discipline: 7, folder: "name-off-its-casing/filename-case", implementation: "filename-case" },
    {
      discipline: 10,
      folder: "thrown-non-error/throw-only-error",
      implementation: "throw-only-error",
    },
    { discipline: 27, folder: "test-switched-off/focused-tests", implementation: "test-modifiers" },
    {
      discipline: 41,
      folder: "tangled-function/cognitive-complexity",
      implementation: "function-complexity",
    },
    {
      discipline: 42,
      folder: "work-inside-a-condition/else-after-an-exit",
      implementation: "else-after-an-exit",
    },
  ])(
    "keeps the previous package specifier for $folder",
    ({ discipline, folder, implementation }) => {
      const piece = `${ESLINT}/${folder}/piece.json`;
      const source = `${SHARED}/${implementation}.ts`;
      const module = `${SHARED}/${implementation}.js`;
      const specifier = `${ESLINT}/${folder}/eslint-plugin.js`;
      const versionOne = `${PACKAGE}/mechanisms/eslint/CD-${discipline}/cd${discipline}/cd${discipline}.eslint-plugin.js`;
      const installed = fileText.read({ path: repositoryFile(piece) });
      assert(installed.outcome === "ok");

      const plan = packagePlanOf({
        sourcePaths: [piece, source],
        pieces: [{ path: piece, text: installed.value }],
      });
      const shared = fileText.exists({ path: repositoryFile(source) });

      expect(PLUGIN_SPECIFIERS).toContainEqual({
        versionOne,
        versionTwo: `${PACKAGE}/${specifier}`,
      });
      expect(plan).toMatchObject({
        outcome: "ok",
        value: { exported: [module, { specifier, module }] },
      });
      expect(shared).toBe("present");
    },
  );
});

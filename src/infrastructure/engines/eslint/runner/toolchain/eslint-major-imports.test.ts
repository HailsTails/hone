import { describe, expect, it } from "vitest";
import { type ImportAllowance, importFactsReaching, importNotMatching, importsOutside, importsWithoutFacts } from "../../../../../../tests/confinement.ts";
import { INSTALLED_DECLARATION_TEXT } from "../../../../../../tests/installed-declaration-text.ts";
import { projectionDeclarationKeyIn, ROOT_PROJECTION_DECLARATION_KEY, withoutProjectionOutputs } from "../../../../../../tests/without-projection-outputs.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ESLINT_MAJOR_SPECIFIER = /^eslint(?:-9)?(?:\/|$)/;

const notAnEslintMajor: ImportAllowance = importNotMatching({ specifier: ESLINT_MAJOR_SPECIFIER });

const loadedOutsideTheBoundaries = import.meta.glob(
  [
    "./**/*.{ts,mts,cts,js,mjs,cjs}",
    "!./node_modules/**",
    "!./.claude/**",
    "!./artefacts/**",
    "!./delivery/install-proof/consumer-proof/**",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-boundary*.ts",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-10/**",
  ],
  { base: "../../../../../../", query: "?raw", import: "default", eager: true },
);

const outsideTheBoundaries = withoutProjectionOutputs({ sources: loadedOutsideTheBoundaries });

const NESTED_DECLARATION_KEY = projectionDeclarationKeyIn({ folder: "src/infrastructure/engines/eslint/runner" });

const UPGRADED_TREE: Readonly<Record<string, string>> = {
  [ROOT_PROJECTION_DECLARATION_KEY]: INSTALLED_DECLARATION_TEXT,
  [NESTED_DECLARATION_KEY]: INSTALLED_DECLARATION_TEXT,
};

const insideTheBoundaries = import.meta.glob(
  [
    "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-boundary.ts",
    "./src/infrastructure/engines/eslint/runner/toolchain/eslint-10/*.ts",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-*/*.test.ts",
  ],
  { base: "../../../../../../", query: "?raw", import: "default", eager: true },
);

describe("where ESLint is imported, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it)", () => {
  it("reads a known file from each scanned set, so no scan is silently empty", () => {
    expect([outsideTheBoundaries, insideTheBoundaries]).toEqual([
      expect.objectContaining({ "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts": expect.any(String) }),
      expect.objectContaining({
        "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-boundary.ts": expect.any(String),
        "./src/infrastructure/engines/eslint/runner/toolchain/eslint-10/eslint-10-boundary.ts": expect.any(String),
      }),
    ]);
  });

  it("finds neither boundary importing ESLint itself, each taking its major through the Rule type the common side names", () => {
    expect(importsOutside({ sources: insideTheBoundaries, allowed: [notAnEslintMajor] })).toEqual([]);
  });

  it("finds every static import and re-export of eslint or eslint-9 outside the two boundaries, by file, specifier, form and names, a list that can only shrink", () => {
    expect(importFactsReaching({ sources: outsideTheBoundaries, specifier: ESLINT_MAJOR_SPECIFIER })).toEqual([
      { file: "./src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts", kind: "import", specifier: "eslint", form: "type-only", names: ["ESLint", "Rule"] },
      { file: "./src/infrastructure/engines/eslint/runner/pieces/native-rules.ts", kind: "import", specifier: "eslint/use-at-your-own-risk", form: "value", names: ["builtinRules"] },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts", kind: "import", specifier: "eslint-9", form: "value", names: ["ESLint"] },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts", kind: "import", specifier: "eslint-9/use-at-your-own-risk", form: "value", names: ["builtinRules"] },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts", kind: "import", specifier: "eslint", form: "type-only", names: ["ESLint"] },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts", kind: "re-export", specifier: "eslint", form: "type-only", names: ["AST", "Rule", "SourceCode"] },
    ]);
  });

  it("finds the root declaration hone project writes importing eslint when nothing is left out, and a declaration of that name in a folder too", () => {
    expect(importsOutside({ sources: UPGRADED_TREE, allowed: [notAnEslintMajor] })).toEqual([
      { file: ROOT_PROJECTION_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
      { file: NESTED_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
    ]);
  });

  it("finds only the declaration of that name in a folder, once the root declaration hone project writes is left out", () => {
    expect(importsOutside({ sources: withoutProjectionOutputs({ sources: UPGRADED_TREE }), allowed: [notAnEslintMajor] })).toEqual([
      { file: NESTED_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
    ]);
  });

  it("finds no static import or re-export of eslint or eslint-9 outside the two boundaries that the facts above fail to hold", () => {
    expect(importsWithoutFacts({ sources: outsideTheBoundaries, specifier: ESLINT_MAJOR_SPECIFIER })).toEqual([]);
  });

  it("finds every import of eslint or eslint-9 of any form outside the two boundaries, the dynamic loads and the one re-export included, by file and form", () => {
    expect(importsOutside({ sources: outsideTheBoundaries, allowed: [notAnEslintMajor] })).toEqual([
      { file: "./src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts", specifier: "eslint", form: "type-only" },
      { file: "./src/infrastructure/engines/eslint/runner/pieces/native-rules.ts", specifier: "eslint/use-at-your-own-risk", form: "value" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts", specifier: "eslint-9", form: "value" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts", specifier: "eslint-9/use-at-your-own-risk", form: "value" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts", specifier: "eslint", form: "type-only" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts", specifier: "eslint", form: "type-only" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts", specifier: "eslint", form: "dynamic" },
      { file: "./tests/eslint-toolchains.ts", specifier: "eslint-9", form: "dynamic" },
      { file: "./tests/eslint-toolchains.ts", specifier: "eslint-9/use-at-your-own-risk", form: "dynamic" },
    ]);
  });
});

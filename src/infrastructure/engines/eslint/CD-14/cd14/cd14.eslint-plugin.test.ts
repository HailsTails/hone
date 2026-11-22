import { assert, describe, expect, it, test } from "vitest";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createEslintPort } from "../../runner/toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../../runner/toolchain/eslint-toolchain.ts";
import { eslintPluginModuleSchema } from "../../runner/pieces/eslint-plugin-schema.ts";
import classAuthoringPlugin, { classDisposition, containerMode } from "./cd14.eslint-plugin.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const keywordAfterNodeStartCases: readonly SourceCase[] = [
  {
    name: "decorator on the line before the class keyword",
    fileName: repoPathOf("decorated.ts"),
    source: "@sealed\nclass Alpha {}\n",
    expectedLines: [2],
  },
  {
    name: "decorated class expression",
    fileName: repoPathOf("decorated-expression.ts"),
    source: "export const Gamma = @sealed\nclass {};\n",
    expectedLines: [2],
  },
];

const loadedPlugin = eslintPluginModuleSchema.parse({ default: classAuthoringPlugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../../../../../..`, installForm: "source" }),
});
assert(loadedToolchain.outcome === "ok", "the eslint-10 toolchain loads from the development install");
assert(/^10\./.test(loadedToolchain.value.eslintVersion), `the eslint-10 toolchain runs ESLint ${loadedToolchain.value.eslintVersion}`);

const eslint = createEslintPort({ toolchain: loadedToolchain.value });

test("runtime class declarations are reported", () => {
  expect(
    classDisposition({
      filename: "src/runtime.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("report");
});

test("class expressions stay runtime syntax", () => {
  expect(
    classDisposition({
      filename: "src/runtime.ts",
      kind: "expression",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("report");
});

test("ambient class declarations are type-only", () => {
  expect(
    classDisposition({
      filename: "src/ambient.ts",
      kind: "declaration",
      declaration: "ambient",
      container: "runtime",
    }),
  ).toBe("allow");
});

test("declaration files are type-only", () => {
  expect(
    classDisposition({
      filename: "src/external.d.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("allow");
});

test("classes enclosed by ambient modules are type-only", () => {
  expect(
    classDisposition({
      filename: "src/ambient.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "ambient",
    }),
  ).toBe("allow");
});

test("the parent walk reaches an ambient module through an ordinary ancestor", () => {
  expect(
    containerMode({
      node: {
        type: "ClassBody",
        parent: { type: "TSModuleDeclaration", declare: true, parent: null },
      },
    }),
  ).toBe("ambient");
});

test("runtime namespaces do not provide an ambient exemption", () => {
  expect(containerMode({ node: { type: "TSModuleDeclaration", parent: null } })).toBe("runtime");
});

test("an unrelated declared node does not provide an ambient exemption", () => {
  expect(
    containerMode({
      node: { type: "VariableDeclaration", declare: true, parent: null },
    }),
  ).toBe("runtime");
});

describe("CD-14 no-class-authoring rule, on a class keyword after its node's start, through the ESLint runner's lintSourceCases", () => {
  it.each(keywordAfterNodeStartCases)("flags exactly the expected lines of the case $name", async (sharedCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone",
        rule: "no-class-authoring",
        options: [],
        cases: [sharedCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sharedCase.name, flaggedLines: sharedCase.expectedLines }],
    });
  });
});

import { assert, describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { createEslintPort } from "../../runner/toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../../runner/toolchain/eslint-toolchain.ts";
import { eslintPluginModuleSchema } from "../../runner/pieces/eslint-plugin-schema.ts";
import cd2Plugin from "./cd2.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd2Plugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../../../../../..`, installForm: "source" }),
});
assert(loadedToolchain.outcome === "ok", "the eslint-10 toolchain loads from the development install");
assert(/^10\./.test(loadedToolchain.value.eslintVersion), `the eslint-10 toolchain runs ESLint ${loadedToolchain.value.eslintVersion}`);

const eslint = createEslintPort({ toolchain: loadedToolchain.value });

const PRESENCE_ASSERTION_SELECTORS = [
  {
    selector: "TSNonNullExpression",
    message: "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
  },
  {
    selector: "[definite=true]",
    message: "CD-2: a definite assignment assertion claims an assignment the compiler cannot see; initialise the binding instead.",
  },
];

const flagCases: readonly SourceCase[] = [
  {
    name: "a non-null assertion on a property read",
    fileName: repoPathSchema.parse("property-read.ts"),
    source: "declare const user: { readonly name?: string };\nexport const name = user.name!;\n",
    expectedLines: [2],
  },
  {
    name: "a non-null assertion before a member call",
    fileName: repoPathSchema.parse("member-call.ts"),
    source: "declare const totals: ReadonlyMap<string, number>;\nexport const shown = totals.get(\"basket\")!.toFixed(2);\n",
    expectedLines: [2],
  },
  {
    name: "a non-null assertion on an assignment target",
    fileName: repoPathSchema.parse("assignment-target.ts"),
    source: "declare const basket: { total?: number };\nexport const reset = (): void => {\n  basket.total! = 0;\n};\n",
    expectedLines: [3],
  },
  {
    name: "a definite assignment assertion on a let",
    fileName: repoPathSchema.parse("definite-let.ts"),
    source: "declare const load: (assign: (value: number) => void) => void;\nlet total!: number;\nload((value) => {\n  total = value;\n});\nexport { total };\n",
    expectedLines: [2],
  },
  {
    name: "a definite assignment assertion on a class field",
    fileName: repoPathSchema.parse("definite-field.ts"),
    source: "export class Account {\n  balance!: number;\n}\n",
    expectedLines: [2],
  },
  {
    name: "a non-null assertion in a tsx file",
    fileName: repoPathSchema.parse("non-null.tsx"),
    source: "declare const labels: readonly string[];\nexport const first = labels[0]!;\n",
    expectedLines: [2],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "a fallback for an absent value",
    fileName: repoPathSchema.parse("fallback.ts"),
    source: "declare const user: { readonly name?: string };\nexport const name = user.name ?? \"anonymous\";\n",
    expectedLines: [],
  },
  {
    name: "logical not and strict inequality",
    fileName: repoPathSchema.parse("negation.ts"),
    source: "declare const ready: boolean;\nexport const waiting = !ready;\nexport const differs = (left: number, right: number): boolean => left !== right;\n",
    expectedLines: [],
  },
  {
    name: "an initialised let and class field",
    fileName: repoPathSchema.parse("initialised.ts"),
    source: "let total: number = 0;\nexport class Account {\n  balance: number = total;\n}\nexport { total };\n",
    expectedLines: [],
  },
  {
    name: "an optional property",
    fileName: repoPathSchema.parse("optional-property.ts"),
    source: "export type Basket = {\n  readonly total?: number;\n};\n",
    expectedLines: [],
  },
];

describe("CD-2 no-restricted-syntax rule with the presence assertion selectors through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd2",
        rule: "no-restricted-syntax",
        options: PRESENCE_ASSERTION_SELECTORS,
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});

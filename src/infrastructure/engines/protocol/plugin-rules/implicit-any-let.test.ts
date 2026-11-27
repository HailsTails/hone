import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { eslintPluginModuleSchema } from "../../eslint/runner/pieces/eslint-plugin-schema.ts";
import { createEslintPort } from "../../eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../eslint/runner/toolchain/eslint-toolchain.ts";
import implicitAnyPlugin from "./implicit-any-let.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: implicitAnyPlugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: `${import.meta.dirname}/../../../../..`,
    installForm: "source",
  }),
});

const implicitFlagCases: readonly SourceCase[] = [
  {
    name: "a bare let declaration",
    fileName: repoPathOf("bare-let.ts"),
    source: "let pending;\npending = 1;\nexport { pending };\n",
    expectedLines: [1],
  },
  {
    name: "a bare var declaration inside a function",
    fileName: repoPathOf("bare-var.ts"),
    source: "export function run(): void {\n  var legacy;\n  legacy = 1;\n}\n",
    expectedLines: [2],
  },
  {
    name: "the first untyped declarator among several",
    fileName: repoPathOf("mixed-declarators.ts"),
    source:
      "const ready = 1;\nlet counted: number = 1, loose;\nloose = ready;\nexport { counted, loose };\n",
    expectedLines: [2],
  },
  {
    name: "a tsx file is governed",
    fileName: repoPathOf("bare-let.tsx"),
    source: "let element;\nelement = 1;\nexport { element };\n",
    expectedLines: [1],
  },
];

const implicitAllowCases: readonly SourceCase[] = [
  {
    name: "a let with a type annotation",
    fileName: repoPathOf("typed-let.ts"),
    source: "let counted: number;\ncounted = 1;\nexport { counted };\n",
    expectedLines: [],
  },
  {
    name: "a let with an initialiser",
    fileName: repoPathOf("initialised-let.ts"),
    source: "let counted = 0;\ncounted += 1;\nexport { counted };\n",
    expectedLines: [],
  },
  {
    name: "a let in a for-in loop head",
    fileName: repoPathOf("for-in-head.ts"),
    source:
      "export function keys(record: Record<string, number>): number {\n  let total = 0;\n  for (let key in record) {\n    total += record[key] ?? 0;\n  }\n  return total;\n}\n",
    expectedLines: [],
  },
  {
    name: "a var in a second for-in loop head",
    fileName: repoPathOf("for-of-head.ts"),
    source:
      "export function sum(numbers: number[]): number {\n  let total = 0;\n  for (var next in numbers) {\n    total += next;\n  }\n  return total;\n}\n",
    expectedLines: [],
  },
  {
    name: "a javascript file is not governed",
    fileName: repoPathOf("bare-let.js"),
    source: "let pending;\npending = 1;\nexport { pending };\n",
    expectedLines: [],
  },
];

describe("CD-1 implicit-any-let rule through the ESLint runner's lintSourceCases", () => {
  it.each([...implicitFlagCases, ...implicitAllowCases])(
    "flags exactly the expected lines of the case $name",
    async (sourceCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd1",
        rule: "implicit-any-let",
        options: [],
        cases: [sourceCase],
      });

      expect(findings).toEqual({
        outcome: "ok",
        value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
      });
    },
  );
});

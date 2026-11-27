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
import cd10Plugin from "./throw-only-error.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd10Plugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: `${import.meta.dirname}/../../../../..`,
    installForm: "source",
  }),
});

const flagCases: readonly SourceCase[] = [
  {
    name: "a logical expression with a literal operand",
    fileName: repoPathOf("logical-literal.ts"),
    source:
      'export function fail(cause: Error | undefined): never {\n  throw cause || "unknown";\n}\n',
    expectedLines: [2],
  },
  {
    name: "a conditional with a literal branch",
    fileName: repoPathOf("conditional-literal.ts"),
    source:
      'export function fail(urgent: boolean): never {\n  throw urgent ? new Error("urgent") : "routine";\n}\n',
    expectedLines: [2],
  },
  {
    name: "an assignment of a literal",
    fileName: repoPathOf("assigned-literal.ts"),
    source:
      'let latest: unknown;\nexport function fail(): never {\n  throw (latest = "stale");\n}\n',
    expectedLines: [3],
  },
  {
    name: "the last operand of a sequence",
    fileName: repoPathOf("sequence-literal.ts"),
    source: 'export function fail(): never {\n  throw (console.log("failing"), 42);\n}\n',
    expectedLines: [2],
  },
  {
    name: "a binary expression",
    fileName: repoPathOf("binary-expression.ts"),
    source: "export function fail(code: number): never {\n  throw code + 1;\n}\n",
    expectedLines: [2],
  },
  {
    name: "a tagged template",
    fileName: repoPathOf("tagged-template.ts"),
    source:
      "declare const tag: (parts: TemplateStringsArray) => string;\nexport function fail(): never {\n  throw tag`broken`;\n}\n",
    expectedLines: [3],
  },
  {
    name: "the undefined identifier",
    fileName: repoPathOf("thrown-undefined.ts"),
    source: "export function fail(): never {\n  throw undefined;\n}\n",
    expectedLines: [2],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "a constructed error",
    fileName: repoPathOf("constructed-error.ts"),
    source: 'export function fail(): never {\n  throw new TypeError("bad");\n}\n',
    expectedLines: [],
  },
  {
    name: "a caught identifier rethrown",
    fileName: repoPathOf("rethrown.ts"),
    source:
      "export function guard(run: () => void): void {\n  try {\n    run();\n  } catch (caught) {\n    throw caught;\n  }\n}\n",
    expectedLines: [],
  },
  {
    name: "a call that produces an error",
    fileName: repoPathOf("error-factory.ts"),
    source:
      "declare const buildError: () => Error;\nexport function fail(): never {\n  throw buildError();\n}\n",
    expectedLines: [],
  },
  {
    name: "a logical expression of two possible errors",
    fileName: repoPathOf("logical-identifiers.ts"),
    source:
      "export function fail(first: Error, second: Error): never {\n  throw first ?? second;\n}\n",
    expectedLines: [],
  },
  {
    name: "a conditional between two constructed errors",
    fileName: repoPathOf("conditional-errors.ts"),
    source:
      'export function fail(urgent: boolean): never {\n  throw urgent ? new Error("urgent") : new RangeError("routine");\n}\n',
    expectedLines: [],
  },
  {
    name: "an assignment of a possible error",
    fileName: repoPathOf("assigned-error.ts"),
    source:
      "let latest: Error | undefined;\nexport function fail(next: Error): never {\n  throw (latest = next);\n}\n",
    expectedLines: [],
  },
];

describe("CD-10 throw-only-error rule through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])(
    "flags exactly the expected lines of the case $name",
    async (sourceCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd10",
        rule: "throw-only-error",
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

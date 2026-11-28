import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { eslintPluginModuleSchema } from "../../runner/pieces/eslint-plugin-schema.ts";
import { createEslintPort } from "../../runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../runner/toolchain/eslint-toolchain.ts";
import cd1Plugin from "./eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd1Plugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});

const anyFlagCases: readonly SourceCase[] = [
  {
    name: "any as an array element type",
    fileName: repoPathOf("any-array.ts"),
    source:
      "const total = 1;\nexport const count = (input: any[]): number => input.length + total;\n",
    expectedLines: [2],
  },
  {
    name: "any as a generic default",
    fileName: repoPathOf("any-default.ts"),
    source: "export const identity = <Subject = any>(subject: Subject): Subject => subject;\n",
    expectedLines: [1],
  },
  {
    name: "any inside a type literal member",
    fileName: repoPathOf("any-member.ts"),
    source: "export type Box = {\n  readonly label: string;\n  readonly content: any;\n};\n",
    expectedLines: [3],
  },
];

const anyAllowCases: readonly SourceCase[] = [
  {
    name: "unknown is the sanctioned open type",
    fileName: repoPathOf("unknown-type.ts"),
    source: "export const accept = (input: unknown): boolean => input !== null;\n",
    expectedLines: [],
  },
  {
    name: "an identifier that merely contains any",
    fileName: repoPathOf("any-identifier.ts"),
    source: 'export const anything = 1;\nexport const companyName = "any";\n',
    expectedLines: [],
  },
];

describe("CD-1 no-explicit-any rule through the ESLint runner's lintSourceCases", () => {
  it.each([...anyFlagCases, ...anyAllowCases])(
    "flags exactly the expected lines of the case $name",
    async (sourceCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd1",
        rule: "no-explicit-any",
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

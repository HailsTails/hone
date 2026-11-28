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
import classAuthoringPlugin from "./eslint-plugin.ts";

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
  peers: defaultEslintToolchainPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});

describe("CD-14 no-class-authoring rule, on a class keyword after its node's start, through the ESLint runner's lintSourceCases", () => {
  it.each(keywordAfterNodeStartCases)(
    "flags exactly the expected lines of the case $name",
    async (sharedCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone",
        rule: "no-class-authoring",
        options: [],
        cases: [sharedCase],
      });

      expect(findings).toEqual({
        outcome: "ok",
        value: [{ caseName: sharedCase.name, flaggedLines: sharedCase.expectedLines }],
      });
    },
  );
});

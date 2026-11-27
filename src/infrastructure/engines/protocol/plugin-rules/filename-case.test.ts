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
import cd7Plugin from "./filename-case.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd7Plugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: `${import.meta.dirname}/../../../../..`,
    installForm: "source",
  }),
});

const flagCases: readonly SourceCase[] = [
  {
    name: "snake case with an interior underscore",
    fileName: repoPathOf("src/snake_case.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "camel case",
    fileName: repoPathOf("src/camelCase.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "all capitals",
    fileName: repoPathOf("src/UPPER.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "a space in the name",
    fileName: repoPathOf("src/my file.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "a non-conventional second extension segment",
    fileName: repoPathOf("src/widget.Test_Spec.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "a route group followed by garbage",
    fileName: repoPathOf("src/(group)extra.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "kebab case with a test extension",
    fileName: repoPathOf("src/kebab-case.test.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "pascal case component",
    fileName: repoPathOf("src/Component.tsx"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "edge underscores are stripped",
    fileName: repoPathOf("src/__init__.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "a leading dot marker is stripped",
    fileName: repoPathOf("src/.config-file.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "a leading plus marker is stripped",
    fileName: repoPathOf("src/+page.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "a dynamic route segment",
    fileName: repoPathOf("src/[id].ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "a catch-all route segment with extensions",
    fileName: repoPathOf("src/[...slug].page.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "only the basename is judged, not its directories",
    fileName: repoPathOf("src/Bad_Directory/ok-name.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
];

describe("filename-case rule through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])(
    "flags exactly the expected lines of the case $name",
    async (sourceCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd7",
        rule: "filename-case",
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

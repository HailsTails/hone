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
import cd27Plugin from "./test-modifiers.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd27Plugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: `${import.meta.dirname}/../../../../..`,
    installForm: "source",
  }),
});

const focusedFlagCases: readonly SourceCase[] = [
  {
    name: "a chained modifier before only",
    fileName: repoPathOf("concurrent-only.ts"),
    source: 'import { test } from "vitest";\ntest.concurrent.only("runs alone", () => {});\n',
    expectedLines: [2],
  },
  {
    name: "a bracketed only member",
    fileName: repoPathOf("bracketed-only.ts"),
    source: 'import { it } from "vitest";\nit["only"]("runs alone", () => {});\n',
    expectedLines: [2],
  },
  {
    name: "an f-prefixed bare call",
    fileName: repoPathOf("bare-fit.ts"),
    source:
      'declare const fit: (name: string, run: () => void) => void;\nfit("runs alone", () => {});\n',
    expectedLines: [2],
  },
  {
    name: "a suite root",
    fileName: repoPathOf("suite-only.ts"),
    source: 'import { suite } from "vitest";\nsuite.only("runs alone", () => {});\n',
    expectedLines: [2],
  },
];

const focusedAllowCases: readonly SourceCase[] = [
  {
    name: "only on an unrelated object",
    fileName: repoPathOf("unrelated-only.ts"),
    source: "declare const queue: { only: () => void };\nqueue.only();\n",
    expectedLines: [],
  },
  {
    name: "a skip modifier is not a focus",
    fileName: repoPathOf("skip-modifier.ts"),
    source: 'import { it } from "vitest";\nit.skip("is parked", () => {});\n',
    expectedLines: [],
  },
  {
    name: "each called before the test body",
    fileName: repoPathOf("each-call.ts"),
    source: 'import { test } from "vitest";\ntest.each([1, 2])("runs %i", () => {});\n',
    expectedLines: [],
  },
  {
    name: "an identifier that only resembles a focus",
    fileName: repoPathOf("onlyfn.ts"),
    source: "declare const onlyFn: () => void;\nonlyFn();\n",
    expectedLines: [],
  },
];

const skippedFlagCases: readonly SourceCase[] = [
  {
    name: "a chained modifier before skip",
    fileName: repoPathOf("concurrent-skip.ts"),
    source: 'import { test } from "vitest";\ntest.concurrent.skip("is parked", () => {});\n',
    expectedLines: [2],
  },
  {
    name: "a bracketed skip member",
    fileName: repoPathOf("bracketed-skip.ts"),
    source: 'import { it } from "vitest";\nit["skip"]("is parked", () => {});\n',
    expectedLines: [2],
  },
  {
    name: "an x-prefixed bare call",
    fileName: repoPathOf("bare-xit.ts"),
    source:
      'declare const xit: (name: string, run: () => void) => void;\nxit("is parked", () => {});\n',
    expectedLines: [2],
  },
  {
    name: "a fixme modifier",
    fileName: repoPathOf("fixme-modifier.ts"),
    source: 'import { test } from "vitest";\ntest.fixme("is broken", () => {});\n',
    expectedLines: [2],
  },
];

const skippedAllowCases: readonly SourceCase[] = [
  {
    name: "skip on an unrelated object",
    fileName: repoPathOf("unrelated-skip.ts"),
    source: "declare const cursor: { skip: (count: number) => void };\ncursor.skip(3);\n",
    expectedLines: [],
  },
  {
    name: "an only modifier is not a skip",
    fileName: repoPathOf("only-modifier.ts"),
    source: 'import { it } from "vitest";\nit.only("runs alone", () => {});\n',
    expectedLines: [],
  },
  {
    name: "an f-prefixed call is not a skip",
    fileName: repoPathOf("bare-fit-skipped.ts"),
    source:
      'declare const fit: (name: string, run: () => void) => void;\nfit("runs alone", () => {});\n',
    expectedLines: [],
  },
];

describe("focused-tests rule through the ESLint runner's lintSourceCases", () => {
  it.each([...focusedFlagCases, ...focusedAllowCases])(
    "flags exactly the expected lines of the case $name",
    async (sourceCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd27",
        rule: "focused-tests",
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

describe("skipped-tests rule through the ESLint runner's lintSourceCases", () => {
  it.each([...skippedFlagCases, ...skippedAllowCases])(
    "flags exactly the expected lines of the case $name",
    async (sourceCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd27",
        rule: "skipped-tests",
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

describe("the skipped-tests conditional and todo option", () => {
  it.each([
    { edition: "1", options: [], expectedLines: [6, 7, 8] },
    { edition: "2", options: ["conditional-and-todo"], expectedLines: [1, 2, 3, 6, 7, 8] },
  ])("reports the expected skip forms in edition $edition", async ({ options, expectedLines }) => {
    const sourceCase: SourceCase = {
      name: "conditionally skipped and deferred tests",
      fileName: repoPathOf("conditional.test.ts"),
      source:
        'it.todo("later");\nit.skipIf(isWindows)("elsewhere", () => {});\nsuite.runIf(hasDatabase)("live", () => {});\nit.each([1])("x", () => {});\nit.concurrent("parallel", () => {});\nit.skip("disabled", () => {});\nit.fixme("broken", () => {});\nxit("disabled", () => {});',
      expectedLines,
    };
    assert(loadedToolchain.outcome === "ok");
    const eslint = createEslintPort({ toolchain: loadedToolchain.value });
    const findings = await eslint.lintSourceCases({
      cwd: PIECE_ROOT,
      plugin: loadedPlugin,
      pluginNamespace: "hone-cd27",
      rule: "skipped-tests",
      options,
      cases: [sourceCase],
    });

    expect(findings).toEqual({
      outcome: "ok",
      value: [
        { caseName: "conditionally skipped and deferred tests", flaggedLines: expectedLines },
      ],
    });
  });
});

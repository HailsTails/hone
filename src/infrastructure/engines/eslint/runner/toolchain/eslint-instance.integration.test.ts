import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { eslintPluginModuleSchema } from "../pieces/eslint-plugin-schema.ts";
import { eslint9ToolchainModules } from "./eslint-9/eslint-9-engine.ts";
import {
  createEslintPort,
  type EslintToolchain,
  governanceConfig,
  type Rule,
} from "./eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "./eslint-toolchain.ts";

const PEERS = defaultEslintToolchainPeers({
  installRoot: `${import.meta.dirname}/../../../../../..`,
  installForm: "source",
});

const ESLINT_LINES = [
  { line: "eslint-10", eslintVersion: "10.15.0", modules: PEERS.modules },
  { line: "eslint-9", eslintVersion: "9.39.5", modules: eslint9ToolchainModules },
];

const CLASS_LISTENER = "ClassDeclaration";

const FUNCTION_LISTENER = "FunctionDeclaration";

const classAndFunctionPlugin = eslintPluginModuleSchema.parse({
  default: {
    rules: {
      "no-class": {
        meta: { type: "problem", messages: { found: "class authored" } },
        create: (context: Rule.RuleContext) => ({
          [CLASS_LISTENER]: (node: Rule.Node) => context.report({ node, messageId: "found" }),
        }),
      },
      "no-function": {
        meta: { type: "problem", messages: { found: "function declared" } },
        create: (context: Rule.RuleContext) => ({
          [FUNCTION_LISTENER]: (node: Rule.Node) => context.report({ node, messageId: "found" }),
        }),
      },
    },
  },
}).default;

const inlineConfigCwd = absolutePathSchema.parse(import.meta.dirname);

const conformanceRoot = absolutePathSchema.parse(`${import.meta.dirname}/../../CD-14`);

const classCase = {
  name: "class",
  fileName: repoPathOf("cases/class.ts"),
  source: "const a = 1;\nclass A {}\n",
  expectedLines: [2],
};

const functionAndClassCase = {
  name: "function-and-class",
  fileName: repoPathOf("cases/function-and-class.ts"),
  source: "function f() {}\nclass A {}\n",
  expectedLines: [2],
};

const disabledClassCase = {
  name: "disabled-class",
  fileName: repoPathOf("cases/disabled-class.ts"),
  source: "/* eslint-disable */\nclass A {}\n",
  expectedLines: [2],
};

const noClassCase = {
  name: "no-class",
  fileName: repoPathOf("cases/no-class.ts"),
  source: "const a = 1;\n",
  expectedLines: [],
};

const lintsGovernanceText = (request: {
  readonly code: string;
  readonly toolchain: EslintToolchain;
}) =>
  request.toolchain
    .createEslint({
      options: {
        cwd: inlineConfigCwd,
        overrideConfigFile: true,
        ignore: false,
        allowInlineConfig: false,
        overrideConfig: governanceConfig({
          plugins: { cd: classAndFunctionPlugin },
          rules: [{ ruleId: "cd/no-class", options: [] }],
          parser: request.toolchain.typescriptParser,
        }),
      },
    })
    .lintText({ code: request.code, filePath: "src/a.ts" });

describe.each(ESLINT_LINES)("lintSourceCases over real $line", ({ modules, eslintVersion }) => {
  it("loads the ESLint line its name states", async () => {
    const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
    assert(toolchain.outcome === "ok", "the toolchain loads from the development install");
    expect(toolchain.value.eslintVersion).toBe(eslintVersion);
  });

  it("returns each case's flagged lines for the requested rule", async () => {
    const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
    assert(toolchain.outcome === "ok", "the toolchain loads from the development install");

    const verdicts = await createEslintPort({ toolchain: toolchain.value }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      options: [],
      cases: [classCase, noClassCase],
    });

    expect(verdicts).toEqual({
      outcome: "ok",
      value: [
        { caseName: "class", flaggedLines: [2] },
        { caseName: "no-class", flaggedLines: [] },
      ],
    });
  });

  it("does not flag lines for another rule of the same plugin", async () => {
    const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
    assert(toolchain.outcome === "ok", "the toolchain loads from the development install");

    const verdicts = await createEslintPort({ toolchain: toolchain.value }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      options: [],
      cases: [functionAndClassCase],
    });

    expect(verdicts).toEqual({
      outcome: "ok",
      value: [{ caseName: "function-and-class", flaggedLines: [2] }],
    });
  });

  it("ignores the inline-config message and is not silenced by a disable comment", async () => {
    const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
    assert(toolchain.outcome === "ok", "the toolchain loads from the development install");

    const verdicts = await createEslintPort({ toolchain: toolchain.value }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      options: [],
      cases: [disabledClassCase],
    });

    expect(verdicts).toEqual({
      outcome: "ok",
      value: [{ caseName: "disabled-class", flaggedLines: [2] }],
    });
  });
});

describe.each(ESLINT_LINES)("the hone-core/inline-config rule over real $line", ({ modules }) => {
  it.each([
    { form: "a disable naming no rule", code: "/* eslint-disable */\nconst a = 1;\n", line: 1 },
    {
      form: "a disable naming the selected rule",
      code: "const a = 1;\n/* eslint-disable cd/no-class */\n",
      line: 2,
    },
    {
      form: "a disable-line naming the selected rule",
      code: "const a = 1; // eslint-disable-line cd/no-class\n",
      line: 1,
    },
    {
      form: "a disable-next-line naming the selected rule",
      code: "// eslint-disable-next-line cd/no-class\nconst a = 1;\n",
      line: 1,
    },
    {
      form: "a disable naming the selected rule among others, with a justification",
      code: "/* eslint-disable no-console, cd/no-class -- generated */\n",
      line: 1,
    },
  ])("reports $form as inline-disable on its line", async ({ code, line }) => {
    const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
    assert(toolchain.outcome === "ok", "the toolchain loads from the development install");

    const linted = await lintsGovernanceText({ code, toolchain: toolchain.value });

    expect(linted).toMatchObject([
      {
        messages: [{ ruleId: "hone-core/inline-config", messageId: "inline-disable", line }],
      },
    ]);
  });

  it("reports a rule-config comment turning the selected rule off as inline-rule-config on its line", async () => {
    const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
    assert(toolchain.outcome === "ok", "the toolchain loads from the development install");

    const linted = await lintsGovernanceText({
      code: 'const a = 1;\n/* eslint cd/no-class: "off" */\n',
      toolchain: toolchain.value,
    });

    expect(linted).toMatchObject([
      {
        messages: [{ ruleId: "hone-core/inline-config", messageId: "inline-rule-config", line: 2 }],
      },
    ]);
  });

  it.each([
    {
      form: "a block disable",
      code: "const a = 1;\n  /* eslint-disable cd/no-class */  \n",
      text: "/* eslint-disable cd/no-class */",
    },
    {
      form: "a line disable",
      code: "const a = 1; // eslint-disable-line cd/no-class\n",
      text: "// eslint-disable-line cd/no-class",
    },
    {
      form: "a rule-config comment",
      code: '/* eslint cd/no-class: "off" */\n',
      text: '/* eslint cd/no-class: "off" */',
    },
  ])(
    "carries $form exactly as written in source, trimmed, as its message",
    async ({ code, text }) => {
      const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
      assert(toolchain.outcome === "ok", "the toolchain loads from the development install");

      const linted = await lintsGovernanceText({ code, toolchain: toolchain.value });

      expect(linted).toMatchObject([
        { messages: [{ ruleId: "hone-core/inline-config", message: text }] },
      ]);
    },
  );

  it("reports an eslint comment whose configuration does not parse as inline-rule-config", async () => {
    const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
    assert(toolchain.outcome === "ok", "the toolchain loads from the development install");

    const linted = await lintsGovernanceText({
      code: "/* eslint cd/no-class: [ */\n",
      toolchain: toolchain.value,
    });

    expect(linted).toMatchObject([
      {
        messages: [{ ruleId: "hone-core/inline-config", messageId: "inline-rule-config", line: 1 }],
      },
    ]);
  });

  it.each([
    { form: "a disable naming only another rule", code: "/* eslint-disable no-console */\n" },
    { form: "a rule-config comment for another rule", code: '/* eslint no-console: "off" */\n' },
    { form: "an enable comment", code: "/* eslint-enable */\n" },
    {
      form: "an enable comment naming the selected rule",
      code: "/* eslint-enable cd/no-class */\n",
    },
    { form: "a global comment", code: "/* global foo */\n" },
    { form: "an exported comment", code: "/* exported foo */\n" },
    { form: "a comment that is not a directive", code: "/* not a directive */\n" },
  ])("reports nothing for $form", async ({ code }) => {
    const toolchain = await loadEslintToolchain({ peers: { location: PEERS.location, modules } });
    assert(toolchain.outcome === "ok", "the toolchain loads from the development install");

    const linted = await lintsGovernanceText({ code, toolchain: toolchain.value });

    expect(linted).toMatchObject([{ messages: [] }]);
  });
});

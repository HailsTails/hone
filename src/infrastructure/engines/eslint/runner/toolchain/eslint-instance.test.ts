import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { eslintPluginModuleSchema } from "../pieces/eslint-plugin-schema.ts";
import { eslint9ToolchainModules } from "./eslint-9/eslint-9-engine.ts";
import {
  type CreateEslint,
  createEslintPort,
  type EslintPort,
  type EslintSurface,
  eslintOptionsOf,
  governanceConfig,
  type LintedFile,
  type Rule,
} from "./eslint-instance.ts";

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

const tmpFilePlugin = eslintPluginModuleSchema.parse({
  default: {
    rules: {
      "no-tmp": { meta: { type: "problem" }, create: () => ({}) },
    },
  },
}).default;

const repoRoot = absoluteRootOf("/repo");

const conformanceRoot = absolutePathSchema.parse(`${import.meta.dirname}/../../CD-14`);
const fileA = repoPathOf("src/a.ts");
const fileB = repoPathOf("src/b.ts");

const classCase = {
  name: "class",
  fileName: repoPathOf("cases/class.ts"),
  source: "const a = 1;\nclass A {}\n",
  expectedLines: [2],
};

const REFUSED_CONFIG_DETAIL = "✖ Invalid input";

const noClassCase = {
  name: "no-class",
  fileName: repoPathOf("cases/no-class.ts"),
  source: "const a = 1;\n",
  expectedLines: [],
};

const lintedA: LintedFile = {
  filePath: "/repo/src/a.ts",
  messages: [{ ruleId: "cd/no-class", line: 2, column: 1, message: "class authored" }],
};

const idleSurface: EslintSurface = {
  isPathIgnored: vi.fn<EslintSurface["isPathIgnored"]>().mockResolvedValue(false),
  calculateConfigForFile: vi
    .fn<EslintSurface["calculateConfigForFile"]>()
    .mockResolvedValue(undefined),
  lintFiles: vi.fn<EslintSurface["lintFiles"]>().mockResolvedValue([]),
  lintText: vi.fn<EslintSurface["lintText"]>().mockResolvedValue([]),
  findConfigFile: vi.fn<EslintSurface["findConfigFile"]>().mockResolvedValue(undefined),
};

const throwsOnBuild = vi.fn<CreateEslint>().mockThrow(new Error("Invalid Options: unknown option"));

const PARSER = await eslint9ToolchainModules.typescriptParser();

const portWith = (request: { readonly createEslint: CreateEslint }): EslintPort =>
  createEslintPort({
    toolchain: {
      eslintVersion: "10.15.0",
      boundary: {
        nearestLookup: { flags: [] },
        reportDataOf: () => undefined,
        projectionTypeText: "unknown[]",
      },
      typescriptParser: PARSER,
      createEslint: request.createEslint,
    },
  });

describe("governanceConfig", () => {
  it("builds one block for TypeScript files", () => {
    expect(
      governanceConfig({
        plugins: { cd: classAndFunctionPlugin },
        rules: [{ ruleId: "cd/no-class", options: [] }],
        parser: PARSER,
      }),
    ).toMatchObject({ files: ["**/*.{ts,tsx,mts,cts}"] });
  });

  it("sets each selected rule id and the inline-config rule to error, with no options", () => {
    expect(
      governanceConfig({
        plugins: { cd: classAndFunctionPlugin, pd: tmpFilePlugin },
        rules: [
          { ruleId: "cd/no-class", options: [] },
          { ruleId: "pd/no-tmp", options: [] },
        ],
        parser: PARSER,
      }).rules,
    ).toEqual({
      "cd/no-class": "error",
      "pd/no-tmp": "error",
      "hone-core/inline-config": "error",
    });
  });

  it("sets a selected rule with options to an error entry followed by those options", () => {
    expect(
      governanceConfig({
        plugins: { cd: classAndFunctionPlugin },
        rules: [{ ruleId: "cd/no-class", options: [{ max: 2 }] }],
        parser: PARSER,
      }).rules,
    ).toEqual({
      "cd/no-class": ["error", { max: 2 }],
      "hone-core/inline-config": "error",
    });
  });

  it("registers each plugin under its namespace beside the hone-core plugin carrying inline-config", () => {
    expect(
      governanceConfig({
        plugins: { cd: classAndFunctionPlugin, pd: tmpFilePlugin },
        rules: [
          { ruleId: "cd/no-class", options: [] },
          { ruleId: "pd/no-tmp", options: [] },
        ],
        parser: PARSER,
      }).plugins,
    ).toEqual({
      cd: classAndFunctionPlugin,
      pd: tmpFilePlugin,
      "hone-core": expect.objectContaining({
        rules: { "inline-config": expect.objectContaining({ create: expect.any(Function) }) },
      }),
    });
  });
});

describe("createQueryInstance", () => {
  it("builds ESLint on the team's own configuration, with the repository root as its only option", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);

    await portWith({ createEslint }).createQueryInstance({ repoRoot }).ignoredState({
      file: fileA,
    });

    expect(createEslint).toHaveBeenCalledWith({ options: { cwd: "/repo" } });
  });

  it("builds ESLint once for every query of one instance", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);
    const queryInstance = portWith({ createEslint }).createQueryInstance({ repoRoot });

    await queryInstance.ignoredState({ file: fileA });
    await queryInstance.ruleState({ file: fileB, ruleId: "cd/no-class" });

    expect(createEslint).toHaveBeenCalledTimes(1);
  });

  it("answers ignored for a path ESLint ignores", async () => {
    const ignoredState = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        isPathIgnored: vi.fn<EslintSurface["isPathIgnored"]>().mockResolvedValue(true),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(ignoredState).toEqual({ outcome: "ok", value: "ignored" });
  });

  it("answers checked for a path ESLint does not ignore", async () => {
    const ignoredState = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        isPathIgnored: vi.fn<EslintSurface["isPathIgnored"]>().mockResolvedValue(false),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(ignoredState).toEqual({ outcome: "ok", value: "checked" });
  });

  it("reads a rule's state from the requested file's resolved configuration", async () => {
    const calculateConfigForFile = vi
      .fn<EslintSurface["calculateConfigForFile"]>()
      .mockResolvedValue({ rules: { "cd/no-class": [2] } });

    const ruleState = await portWith({
      createEslint: vi
        .fn<CreateEslint>()
        .mockReturnValue({ ...idleSurface, calculateConfigForFile }),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileB, ruleId: "cd/no-class" });

    expect([ruleState, calculateConfigForFile.mock.calls]).toEqual([
      { outcome: "ok", value: { state: "configured", severity: 2, options: [] } },
      [[{ filePath: "src/b.ts" }]],
    ]);
  });

  it("reads an undefined resolved configuration as file-ignored", async () => {
    const ruleState = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue(idleSurface),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileA, ruleId: "cd/no-class" });

    expect(ruleState).toEqual({ outcome: "ok", value: { state: "file-ignored" } });
  });

  it("reports a resolved configuration the schema refuses as runner-invalid-output", async () => {
    const ruleState = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        calculateConfigForFile: vi
          .fn<EslintSurface["calculateConfigForFile"]>()
          .mockResolvedValue({ rules: { "cd/no-class": ["error"] } }),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileA, ruleId: "cd/no-class" });

    expect(ruleState).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: REFUSED_CONFIG_DETAIL },
    });
  });

  it("reports ESLint refusing to redefine a plugin while answering a rule state as plugin-conflict", async () => {
    const ruleState = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        calculateConfigForFile: vi
          .fn<EslintSurface["calculateConfigForFile"]>()
          .mockRejectedValue(
            new Error('Config "team": Key "plugins": Cannot redefine plugin "cd".'),
          ),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileA, ruleId: "cd/no-class" });

    expect(ruleState).toEqual({
      outcome: "failed",
      error: {
        kind: "plugin-conflict",
        detail: 'Config "team": Key "plugins": Cannot redefine plugin "cd".',
      },
    });
  });

  it("reports any other rejection while answering a rule state as team-config-unloadable", async () => {
    const ruleState = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        calculateConfigForFile: vi
          .fn<EslintSurface["calculateConfigForFile"]>()
          .mockRejectedValue(new Error("Unexpected token in eslint.config.js")),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileA, ruleId: "cd/no-class" });

    expect(ruleState).toEqual({
      outcome: "failed",
      error: { kind: "team-config-unloadable", detail: "Unexpected token in eslint.config.js" },
    });
  });

  it("names the config ESLint finds for a file, so a failure to load it can say which config it was", async () => {
    const findConfigFile = vi
      .fn<EslintSurface["findConfigFile"]>()
      .mockResolvedValue("/repo/fixtures/broken/eslint.config.mjs");
    const configFile = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, findConfigFile }),
    })
      .createQueryInstance({ repoRoot })
      .configFileOf({ file: fileA });

    expect([configFile, findConfigFile.mock.calls]).toEqual([
      { kind: "found", path: "/repo/fixtures/broken/eslint.config.mjs" },
      [[{ filePath: fileA }]],
    ]);
  });

  it("says no config applies when ESLint finds none for the file", async () => {
    const configFile = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue(idleSurface),
    })
      .createQueryInstance({ repoRoot })
      .configFileOf({ file: fileA });

    expect(configFile).toEqual({ kind: "none" });
  });

  it("says the config is unknown when ESLint cannot search for one", async () => {
    const configFile = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        findConfigFile: vi
          .fn<EslintSurface["findConfigFile"]>()
          .mockRejectedValue(new Error("ENOENT")),
      }),
    })
      .createQueryInstance({ repoRoot })
      .configFileOf({ file: fileA });

    expect(configFile).toEqual({ kind: "unknown" });
  });

  it("reports ESLint failing to build as tool-failed", async () => {
    const ignoredState = await portWith({ createEslint: throwsOnBuild })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(ignoredState).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "Invalid Options: unknown option" },
    });
  });
});

describe("createGovernanceInstance", () => {
  it("builds ESLint on the runner's own complete configuration, never the team's", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);

    await portWith({ createEslint })
      .createGovernanceInstance({
        repoRoot,
        plugins: { cd: classAndFunctionPlugin },
        rules: [{ ruleId: "cd/no-class", options: [] }],
      })
      .lintFiles({ files: [fileA] });

    expect(createEslint).toHaveBeenCalledWith({
      options: {
        cwd: "/repo",
        overrideConfigFile: true,
        ignore: false,
        allowInlineConfig: false,
        overrideConfig: expect.objectContaining({
          files: ["**/*.{ts,tsx,mts,cts}"],
          rules: { "cd/no-class": "error", "hone-core/inline-config": "error" },
        }),
      },
    });
  });

  it("lints the requested files and returns ESLint's results", async () => {
    const lintFiles = vi.fn<EslintSurface["lintFiles"]>().mockResolvedValue([lintedA]);

    const linted = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, lintFiles }),
    })
      .createGovernanceInstance({
        repoRoot,
        plugins: { cd: classAndFunctionPlugin },
        rules: [{ ruleId: "cd/no-class", options: [] }],
      })
      .lintFiles({ files: [fileA, fileB] });

    expect([linted, lintFiles.mock.calls]).toEqual([
      { outcome: "ok", value: [lintedA] },
      [[{ filePaths: ["src/a.ts", "src/b.ts"] }]],
    ]);
  });

  it("gives no results for no files, without calling ESLint, which would read an empty list as the whole folder", async () => {
    const lintFiles = vi.fn<EslintSurface["lintFiles"]>().mockResolvedValue([lintedA]);
    const governance = portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, lintFiles }),
    }).createGovernanceInstance({
      repoRoot,
      plugins: { cd: classAndFunctionPlugin },
      rules: [{ ruleId: "cd/no-class", options: [] }],
    });

    const linted = await governance.lintFiles({ files: [] });

    expect([linted, lintFiles.mock.calls]).toEqual([{ outcome: "ok", value: [] }, []]);
  });

  it("reports a rejecting lint as tool-failed", async () => {
    const linted = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintFiles: vi
          .fn<EslintSurface["lintFiles"]>()
          .mockRejectedValue(new Error("visitor is not a function")),
      }),
    })
      .createGovernanceInstance({
        repoRoot,
        plugins: { cd: classAndFunctionPlugin },
        rules: [{ ruleId: "cd/no-class", options: [] }],
      })
      .lintFiles({ files: [fileA] });

    expect(linted).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "visitor is not a function" },
    });
  });
});

describe("lintSourceCases", () => {
  it("lints each case's source as text under its file name", async () => {
    const lintText = vi.fn<EslintSurface["lintText"]>().mockResolvedValue([]);

    await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, lintText }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      options: [],
      cases: [classCase, noClassCase],
    });

    expect(lintText.mock.calls).toEqual([
      [{ code: "const a = 1;\nclass A {}\n", filePath: "cases/class.ts" }],
      [{ code: "const a = 1;\n", filePath: "cases/no-class.ts" }],
    ]);
  });

  it("builds ESLint on the governance configuration for the one requested rule, ignoring any configuration file", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);

    await portWith({ createEslint }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      options: [],
      cases: [classCase],
    });

    expect(createEslint).toHaveBeenCalledWith({
      options: expect.objectContaining({
        cwd: conformanceRoot,
        overrideConfigFile: true,
        allowInlineConfig: false,
        overrideConfig: expect.objectContaining({
          plugins: expect.objectContaining({ cd: classAndFunctionPlugin }),
          rules: { "cd/no-class": "error", "hone-core/inline-config": "error" },
        }),
      }),
    });
  });

  it("reports an inline-config-unreadable message as tool-failed", async () => {
    const verdicts = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintText: vi.fn<EslintSurface["lintText"]>().mockResolvedValue([
          {
            filePath: "/install/mechanisms/eslint/CD-14/cases/class.ts",
            messages: [
              {
                ruleId: "hone-core/inline-config",
                messageId: "inline-config-unreadable",
                line: 1,
                column: 1,
                message: "inline configuration comments could not be read",
              },
            ],
          },
        ]),
      }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      options: [],
      cases: [classCase],
    });

    expect(verdicts).toEqual({
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: "inline configuration comments could not be read in case class",
      },
    });
  });

  it("reports a case holding a fatal message as runner-invalid-output naming that case", async () => {
    const verdicts = await portWith({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintText: vi.fn<EslintSurface["lintText"]>().mockResolvedValue([
          {
            filePath: "/install/mechanisms/eslint/CD-14/cases/class.ts",
            messages: [
              {
                ruleId: null,
                line: 1,
                column: 7,
                message: "Parsing error: '{' expected.",
                fatal: true,
              },
            ],
          },
        ]),
      }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      options: [],
      cases: [classCase],
    });

    expect(verdicts).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail: "case class was not linted as a rule source: Parsing error: '{' expected.",
      },
    });
  });
});

const OPTIONS_CWD = absoluteRootOf("/repo");

const NO_LOOKUP = { flags: [] };

const NAMED_LOOKUP = { flags: ["a-lookup-flag"] };

describe("eslintOptionsOf, which asks ESLint for the configuration nearest each file", () => {
  it("passes the options through unchanged when the boundary names no lookup flag", () => {
    expect(eslintOptionsOf({ nearestLookup: NO_LOOKUP, options: { cwd: OPTIONS_CWD } })).toEqual({
      cwd: OPTIONS_CWD,
    });
  });

  it("asks ESLint for the lookup by the flags the boundary names", () => {
    expect(eslintOptionsOf({ nearestLookup: NAMED_LOOKUP, options: { cwd: OPTIONS_CWD } })).toEqual(
      {
        cwd: OPTIONS_CWD,
        flags: ["a-lookup-flag"],
      },
    );
  });

  it("names no lookup flag when a configuration file is named", () => {
    expect(
      eslintOptionsOf({
        nearestLookup: NAMED_LOOKUP,
        options: {
          cwd: OPTIONS_CWD,
          overrideConfigFile: true,
          ignore: false,
          allowInlineConfig: false,
        },
      }),
    ).toEqual({
      cwd: OPTIONS_CWD,
      overrideConfigFile: true,
      ignore: false,
      allowInlineConfig: false,
    });
  });
});

describe("ignoredByConfig, whether one named config really ignores a path", () => {
  it("builds ESLint on that config from its own folder, matching the asked path so an unconfigured path is not taken for an ignored one", async () => {
    const isPathIgnored = vi.fn<EslintSurface["isPathIgnored"]>().mockResolvedValue(true);
    const createEslint = vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, isPathIgnored });
    const ignored = await portWith({ createEslint }).ignoredByConfig({
      configFile: "/repo/eslint.config.mjs",
      cwd: repoRoot,
      path: "fixtures/bad/hone-folder-probe",
    });
    expect({ ignored, built: createEslint.mock.calls, asked: isPathIgnored.mock.calls }).toEqual({
      ignored: { outcome: "ok", value: "ignored" },
      built: [
        [
          {
            options: {
              cwd: "/repo",
              overrideConfigFile: "/repo/eslint.config.mjs",
              matchedFiles: ["fixtures/bad/hone-folder-probe"],
            },
          },
        ],
      ],
      asked: [[{ filePath: "fixtures/bad/hone-folder-probe" }]],
    });
  });

  it("answers checked for a path the config does not ignore", async () => {
    await expect(
      portWith({
        createEslint: vi.fn<CreateEslint>().mockReturnValue(idleSurface),
      }).ignoredByConfig({
        configFile: "/repo/eslint.config.mjs",
        cwd: repoRoot,
        path: "src/a.ts",
      }),
    ).resolves.toEqual({ outcome: "ok", value: "checked" });
  });

  it("reports the config failing to load as team-config-unloadable", async () => {
    await expect(
      portWith({
        createEslint: vi.fn<CreateEslint>().mockReturnValue({
          ...idleSurface,
          isPathIgnored: vi
            .fn<EslintSurface["isPathIgnored"]>()
            .mockRejectedValue(new Error("Unexpected token ';'")),
        }),
      }).ignoredByConfig({
        configFile: "/repo/eslint.config.mjs",
        cwd: repoRoot,
        path: "src/a.ts",
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "team-config-unloadable", detail: "Unexpected token ';'" },
    });
  });
});

describe("eslintOptionsOf for a question about one path", () => {
  it("matches the named paths with a files-only override block", () => {
    expect(
      eslintOptionsOf({
        nearestLookup: NO_LOOKUP,
        options: {
          cwd: OPTIONS_CWD,
          overrideConfigFile: "/repo/eslint.config.mjs",
          matchedFiles: ["src/a.ts"],
        },
      }),
    ).toEqual({
      cwd: OPTIONS_CWD,
      overrideConfigFile: "/repo/eslint.config.mjs",
      overrideConfig: { files: ["src/a.ts"] },
    });
  });
});
describe("ignoredByPatterns, whether ignore patterns given on a command line ignore each path", () => {
  it("builds one ESLint from the script's folder with no config file and only those patterns, matching each asked path so an unconfigured path is not taken for an ignored one", async () => {
    const isPathIgnored = vi
      .fn<EslintSurface["isPathIgnored"]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const createEslint = vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, isPathIgnored });
    const packageFolder = absoluteRootOf("/repo/packages/a");
    const ignored = await portWith({ createEslint }).ignoredByPatterns({
      cwd: packageFolder,
      patterns: ["dist/**"],
      paths: ["src/a.ts", "dist/b.ts"],
    });
    expect({ ignored, built: createEslint.mock.calls, asked: isPathIgnored.mock.calls }).toEqual({
      ignored: { outcome: "ok", value: ["checked", "ignored"] },
      built: [
        [
          {
            options: {
              cwd: "/repo/packages/a",
              overrideConfigFile: true,
              ignorePatterns: ["dist/**"],
              matchedFiles: ["src/a.ts", "dist/b.ts"],
            },
          },
        ],
      ],
      asked: [[{ filePath: "src/a.ts" }], [{ filePath: "dist/b.ts" }]],
    });
  });

  it("reports a pattern ESLint cannot use as tool-failed", async () => {
    await expect(
      portWith({
        createEslint: vi.fn<CreateEslint>().mockReturnValue({
          ...idleSurface,
          isPathIgnored: vi
            .fn<EslintSurface["isPathIgnored"]>()
            .mockRejectedValue(new Error("Invalid pattern")),
        }),
      }).ignoredByPatterns({ cwd: repoRoot, patterns: ["["], paths: ["src/a.ts"] }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "Invalid pattern" },
    });
  });
});

describe("eslintOptionsOf for ignore patterns", () => {
  it("passes the patterns to ESLint as its own ignorePatterns option", () => {
    expect(
      eslintOptionsOf({
        nearestLookup: NO_LOOKUP,
        options: {
          cwd: OPTIONS_CWD,
          overrideConfigFile: true,
          ignorePatterns: ["dist/**"],
          matchedFiles: ["src/a.ts"],
        },
      }),
    ).toEqual({
      cwd: OPTIONS_CWD,
      overrideConfigFile: true,
      ignorePatterns: ["dist/**"],
      overrideConfig: { files: ["src/a.ts"] },
    });
  });
});

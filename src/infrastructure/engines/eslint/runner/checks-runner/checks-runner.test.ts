import { assert, describe, expect, it, vi } from "vitest";

import type {
  EngineCheck,
  NamedEslintRunRequest,
} from "../../../../../application/ports/engine/engine-run.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../../../domain/rule-set/rule-set-name-of.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import ESLINT_CD_14_PIECE from "../../authored-class-or-this/class-keyword/piece.json" with { type: "json" };
import { checksProjectionText } from "../projection/checks-projection.ts";
import type { CurrentProjection, ProjectionFiles } from "../projection/projection.ts";
import type { RuleState } from "../toolchain/eslint-config-schema.ts";
import type {
  EslintPort,
  GovernanceInstance,
  QueryInstance,
} from "../toolchain/eslint-instance.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import type { ChecksRunnerPorts } from "./checks-ports.ts";
import type { ChecksRepository } from "./checks-repository.ts";
import { checksRunnerOver } from "./checks-runner.ts";

const CHECKS_PROJECTION_PATH = repoPathOf("hone.eslint.mjs");

const CHECKS_DECLARATION_PATH = repoPathOf("hone.eslint.d.mts");

const DECLARATION_TEXT =
  "declare const projection: readonly unknown[];\nexport default projection;\n";

const SILENT_BOUNDARY: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: () => undefined,
  declarationText: DECLARATION_TEXT,
};

const eslint: EslintPort = {
  boundary: SILENT_BOUNDARY,
  createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>(),
  createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>(),
  ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>(),
  ignoredByPatterns: vi.fn<EslintPort["ignoredByPatterns"]>(),
  lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
};

const path = createDefaultPathPort({});

const modules: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const runner = checksRunnerOver({
  ports: {
    repositoryAt: vi.fn<ChecksRunnerPorts["repositoryAt"]>(),
    coreInstall: vi.fn<ChecksRunnerPorts["coreInstall"]>(),
    modules,
    path,
    eslint,
  },
  platform: {
    fileText: createDefaultFileTextPort({}),
    fileRemoval: createDefaultFileRemovalPort({}),
    modules,
    path,
    eslint,
    moduleExtension: ".ts",
  },
});

const REQUEST: NamedEslintRunRequest = {
  repoRoot: absoluteRootOf("/repo"),
  installRoot: absoluteRootOf("/install"),
  files: [repoPathOf("src/a.ts")],
  trackedPaths: [repoPathOf("src/a.ts")],
  checks: [],
  bindings: [],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
  projectionKind: "mjs",
  testFiles: { suffixes: ["test", "spec"], folders: [] },
};

const NESTED_FOLDER = repoPathOf("vendor/lib");
const NESTED_SOURCE = repoPathOf("vendor/lib/src/a.ts");
const NESTED_SETTINGS = repoPathOf("vendor/lib/hone.config.json");
const NESTED_ESLINT = repoPathOf("vendor/lib/eslint.config.mjs");

describe("checksRunnerOver", () => {
  it("continues when a nested repository holds files and no checks are selected", async () => {
    await expect(
      runner.run({
        ...REQUEST,
        files: [NESTED_SOURCE],
        trackedPaths: [NESTED_SETTINGS, NESTED_SOURCE],
      }),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current", slices: [] } });
  });

  it("reports a current projection and no findings when no check runs on ESLint", async () => {
    expect(await runner.run(REQUEST)).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    });
  });
});

const REAL_INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const SCRATCH_REPO_ROOT = absolutePathSchema.parse(`${REAL_INSTALL_ROOT}/artefacts/scratch`);

const INSTALLED_ESLINT_PACKAGE_JSON = path.join({
  segments: [SCRATCH_REPO_ROOT, "node_modules", "eslint", "package.json"],
});

const CLASS_PIECE_JSON = path.join({
  segments: [
    REAL_INSTALL_ROOT,
    "src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/piece.json",
  ],
});

const CLASS_KEYWORD_CHECK: EngineCheck = {
  name: "class-keyword",
  symptom: {
    ruleSet: TOOL_RULE_SET,
    name: "authored-class-or-this",
    title: "Authored class or this",
  },
  engines: [{ name: "walker" }, { name: "eslint" }],
};

const CLASS_PROJECTED = {
  ruleSet: TOOL_RULE_SET,
  symptom: "authored-class-or-this",
  check: "class-keyword",
  ruleId: "hone/authored-class-or-this#class-keyword",
  options: [],
};

const CURRENT_PROJECTION_TEXT = checksProjectionText({
  kind: "mjs",
  pluginImport: "../../src/eslint-plugin.ts",
  checks: [CLASS_PROJECTED],
  answered: [],
});

const CLASS_BINDINGS: NamedEslintRunRequest["bindings"] = [
  {
    address: "authored-class-or-this#class-keyword",
    ruleSet: TOOL_RULE_SET,
    engine: "eslint",
    pieceRoot: `${REAL_INSTALL_ROOT}/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword`,
    settings: ESLINT_CD_14_PIECE.settings,
    anchor: { kind: "keyword", keyword: "class" },
    checkSettings: {},
    edition: editionOf("1"),
  },
];

const SELECTING_THE_CLASS_CHECK: NamedEslintRunRequest = {
  repoRoot: SCRATCH_REPO_ROOT,
  installRoot: REAL_INSTALL_ROOT,
  files: [repoPathOf("kept.ts")],
  trackedPaths: [repoPathOf("kept.ts")],
  checks: [CLASS_KEYWORD_CHECK],
  bindings: CLASS_BINDINGS,
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: "nearest-to-file",
  projectionKind: "mjs",
  testFiles: { suffixes: ["test", "spec"], folders: [] },
};

const CONFIGURED_ON: RuleState = { state: "configured", severity: 2, options: [] };

const RULE_ABSENT: RuleState = { state: "rule-absent" };

const PROJECTION_WRITTEN_AS_PROJECT_WOULD: CurrentProjection = {
  presence: "present",
  text: CURRENT_PROJECTION_TEXT,
};

const PROJECTION_THAT_DIFFERS: CurrentProjection = {
  presence: "present",
  text: `${CURRENT_PROJECTION_TEXT}\n`,
};

const PROJECTION_NOT_WRITTEN: CurrentProjection = { presence: "absent" };

const DECLARATION_PRESENT: CurrentProjection = { presence: "present", text: DECLARATION_TEXT };

const rootOnly = (current: CurrentProjection): ReadonlyMap<RepoPath, CurrentProjection> =>
  new Map([
    [CHECKS_PROJECTION_PATH, current],
    [CHECKS_DECLARATION_PATH, DECLARATION_PRESENT],
  ]);

const projectionFilesHolding = (
  currents: ReadonlyMap<RepoPath, CurrentProjection>,
): ProjectionFiles => ({
  currentOf: vi
    .fn<ProjectionFiles["currentOf"]>()
    .mockReturnValue({ outcome: "ok", value: currents }),
  writeAt: vi.fn<ProjectionFiles["writeAt"]>(),
  removeAt: vi.fn<ProjectionFiles["removeAt"]>(),
});

const repositoryHolding = (
  currents: ReadonlyMap<RepoPath, CurrentProjection>,
): ChecksRepository => ({
  projectionFiles: projectionFilesHolding(currents),
  packageScriptsAt: vi.fn<ChecksRepository["packageScriptsAt"]>(),
  suppressionsAt: vi.fn<ChecksRepository["suppressionsAt"]>(),
  sourceLines: vi.fn<ChecksRepository["sourceLines"]>(),
});

const queryInstanceOver = (ruleState: RuleState): QueryInstance => ({
  ignoredState: vi
    .fn<QueryInstance["ignoredState"]>()
    .mockResolvedValue({ outcome: "ok", value: "checked" }),
  ruleState: vi
    .fn<QueryInstance["ruleState"]>()
    .mockResolvedValue({ outcome: "ok", value: ruleState }),
  configFileOf: vi.fn<QueryInstance["configFileOf"]>(),
});

const lintingNothing = (): GovernanceInstance => ({
  lintFiles: vi
    .fn<GovernanceInstance["lintFiles"]>()
    .mockResolvedValue({ outcome: "ok", value: [] }),
});

const runnerOverQuery = (stubs: {
  readonly currents: ReadonlyMap<RepoPath, CurrentProjection>;
  readonly governance: GovernanceInstance;
  readonly fileText: FileTextPort;
  readonly query: QueryInstance;
  readonly repository?: Partial<ChecksRepository>;
}) => {
  const realModules = createDefaultModuleLoaderPort({});
  const stubbedEslint: EslintPort = {
    boundary: SILENT_BOUNDARY,
    createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>().mockReturnValue(stubs.query),
    createGovernanceInstance: vi
      .fn<EslintPort["createGovernanceInstance"]>()
      .mockReturnValue(stubs.governance),
    ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>(),
    ignoredByPatterns: vi.fn<EslintPort["ignoredByPatterns"]>(),
    lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
  };
  return checksRunnerOver({
    ports: {
      repositoryAt: vi
        .fn<ChecksRunnerPorts["repositoryAt"]>()
        .mockReturnValue({ ...repositoryHolding(stubs.currents), ...stubs.repository }),
      coreInstall: vi
        .fn<ChecksRunnerPorts["coreInstall"]>()
        .mockReturnValue({ outcome: "ok", value: { form: "source" } }),
      modules: realModules,
      path,
      eslint: stubbedEslint,
    },
    platform: {
      fileText: stubs.fileText,
      fileRemoval: createDefaultFileRemovalPort({}),
      modules: realModules,
      path,
      eslint: stubbedEslint,
      moduleExtension: ".ts",
    },
  });
};

const runnerOverProjectionReading = (stubs: {
  readonly currents: ReadonlyMap<RepoPath, CurrentProjection>;
  readonly ruleState: RuleState;
  readonly governance: GovernanceInstance;
  readonly fileText: FileTextPort;
}) => runnerOverQuery({ ...stubs, query: queryInstanceOver(stubs.ruleState) });

const runnerOverProjection = (stubs: {
  readonly currents: ReadonlyMap<RepoPath, CurrentProjection>;
  readonly ruleState: RuleState;
  readonly governance: GovernanceInstance;
}) => runnerOverProjectionReading({ ...stubs, fileText: createDefaultFileTextPort({}) });

describe("checksRunnerOver, measuring an inspected version one projection", () => {
  it("reports the unapplied package to upgrade separately from the named check report", async () => {
    const webSource = repoPathOf("packages/web/src/a.ts");
    const webProjection = repoPathOf("packages/web/disciplines.eslint.mjs");
    const runner = runnerOverProjection({
      currents: rootOnly(PROJECTION_NOT_WRITTEN),
      ruleState: RULE_ABSENT,
      governance: lintingNothing(),
    });
    const run: NamedEslintRunRequest = {
      ...SELECTING_THE_CLASS_CHECK,
      files: [webSource],
      trackedPaths: [webSource],
    };

    await expect(
      runner.measureVersionOne({
        run,
        projection: {
          settingsFile: "disciplines.json",
          projectionFile: repoPathOf("disciplines.eslint.mjs"),
          packageFiles: [webProjection],
          rules: new Map([["authored-class-or-this#class-keyword", "cd14/no-class"]]),
        },
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        report: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "not-included",
          projectionFile: "disciplines.eslint.mjs",
          slices: [],
        },
        unappliedSlices: [webProjection],
      },
    });
  });
});

describe("checksRunnerOver, reporting the state of hone.eslint.ts for the ts projection kind", () => {
  it("compares hone.eslint.ts alone, reports it current and lints the files it is given when it is what project would write", async () => {
    const governance = lintingNothing();
    const currentOf = vi.fn<ProjectionFiles["currentOf"]>().mockReturnValue({
      outcome: "ok",
      value: new Map([
        [
          repoPathOf("hone.eslint.ts"),
          {
            presence: "present",
            text: 'import hone from "../../src/eslint-plugin.ts";\nconst projection: {\n  name: string;\n  files: string[];\n  ignores?: string[];\n  plugins?: Record<string, object>;\n  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;\n}[] = [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.ts"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } }];\nexport default projection;\n',
          },
        ],
      ]),
    });
    const runner = runnerOverQuery({
      currents: new Map(),
      fileText: createDefaultFileTextPort({}),
      query: queryInstanceOver(CONFIGURED_ON),
      governance,
      repository: {
        projectionFiles: {
          currentOf,
          writeAt: vi.fn<ProjectionFiles["writeAt"]>(),
          removeAt: vi.fn<ProjectionFiles["removeAt"]>(),
        },
      },
    });

    const outcome = await runner.run({
      ...SELECTING_THE_CLASS_CHECK,
      projectionKind: "ts",
      files: [repoPathOf("kept.ts")],
      trackedPaths: [repoPathOf("kept.ts"), repoPathOf("hone.eslint.ts")],
    });

    expect({
      outcome,
      compared: currentOf.mock.calls,
      linted: vi.mocked(governance.lintFiles).mock.calls,
    }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [],
        },
      },
      compared: [[{ files: ["hone.eslint.ts"] }]],
      linted: [[{ files: ["kept.ts"] }]],
    });
  });

  it("reports hone.eslint.ts out of date when it differs from what project would write", async () => {
    const governance = lintingNothing();
    const runner = runnerOverProjection({
      currents: new Map([
        [repoPathOf("hone.eslint.ts"), { presence: "present", text: "export default [];\n" }],
      ]),
      ruleState: CONFIGURED_ON,
      governance,
    });

    const outcome = await runner.run({ ...SELECTING_THE_CLASS_CHECK, projectionKind: "ts" });

    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "out-of-date",
        projectionFile: "hone.eslint.ts",
        slices: [],
      },
    });
  });

  it("reports hone.eslint.ts missing, and lints nothing, when only the mjs kind's files are written", async () => {
    const governance = lintingNothing();
    const runner = runnerOverProjection({
      currents: new Map([
        [repoPathOf("hone.eslint.ts"), { presence: "absent" }],
        [repoPathOf("hone.eslint.mjs"), { presence: "present", text: "export default [];\n" }],
      ]),
      ruleState: CONFIGURED_ON,
      governance,
    });

    const outcome = await runner.run({ ...SELECTING_THE_CLASS_CHECK, projectionKind: "ts" });

    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "missing",
          projectionFile: "hone.eslint.ts",
          slices: [],
        },
      },
      linted: [],
    });
  });
});

describe("checksRunnerOver, reporting the state of hone.eslint.mjs from the repository's reader", () => {
  it("reports a missing projection, and lints nothing, when hone.eslint.mjs is not written", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_NOT_WRITTEN),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "missing",
          projectionFile: "hone.eslint.mjs",
          slices: [],
        },
      },
      linted: [],
    });
  });

  it("reports an out-of-date projection, and still lints the files, when hone.eslint.mjs differs from what project would write", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_THAT_DIFFERS),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "out-of-date",
          projectionFile: "hone.eslint.mjs",
          slices: [],
        },
      },
      linted: [[{ files: SELECTING_THE_CLASS_CHECK.files }]],
    });
  });

  it("reports the projection current, and lints the files, when hone.eslint.mjs is what project would write and the team's config enables the check", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [],
        },
      },
      linted: [[{ files: SELECTING_THE_CLASS_CHECK.files }]],
    });
  });

  it("reports a suppression entry from eslint-suppressions.json in the report's native exceptions", async () => {
    const outcome = await runnerOverQuery({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      fileText: createDefaultFileTextPort({}),
      query: queryInstanceOver(CONFIGURED_ON),
      governance: lintingNothing(),
      repository: {
        suppressionsAt: vi.fn<ChecksRepository["suppressionsAt"]>().mockReturnValue({
          outcome: "ok",
          value: { "kept.ts": { "hone/authored-class-or-this#class-keyword": { count: 1 } } },
        }),
      },
    }).run({
      ...SELECTING_THE_CLASS_CHECK,
      trackedPaths: [repoPathOf("kept.ts"), repoPathOf("eslint-suppressions.json")],
    });

    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "suppression-entry",
            file: "kept.ts",
            location: "eslint-suppressions.json",
            check: "authored-class-or-this#class-keyword",
          },
        ],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    });
  });

  it("builds Hone's plugin from Hone's own checks only, leaving a team rule set's check out", async () => {
    const teamCheck: EngineCheck = {
      ...CLASS_KEYWORD_CHECK,
      symptom: { ruleSet: { name: ruleSetNameOf("acme") }, name: "team-only", title: "Team only" },
    };
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
    }).run({ ...SELECTING_THE_CLASS_CHECK, checks: [CLASS_KEYWORD_CHECK, teamCheck] });
    expect(outcome).toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("reports the projection out of date, and lints nothing, when it differs from what project would write and the team's config leaves the check's rule out of a checked file", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_THAT_DIFFERS),
      ruleState: RULE_ABSENT,
      governance,
    }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "out-of-date",
          projectionFile: "hone.eslint.mjs",
          slices: [],
        },
      },
      linted: [],
    });
  });

  it("names the nested Hone folder when its nearest lint config leaves the projection out of effect", async () => {
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: RULE_ABSENT,
      governance: lintingNothing(),
    }).run({
      ...SELECTING_THE_CLASS_CHECK,
      files: [NESTED_SOURCE],
      trackedPaths: [NESTED_SETTINGS, NESTED_ESLINT, NESTED_SOURCE],
    });
    expect(outcome).toMatchObject({
      outcome: "ok",
      value: {
        projection: "not-included",
        projectionFile: "hone.eslint.mjs",
        nestedConfigurations: [NESTED_FOLDER],
        unprojectedFolders: [{ folder: NESTED_FOLDER, selectionFolder: NESTED_FOLDER }],
        slices: [],
      },
    });
  });

  it("reports the projection not included, and lints nothing, when the team's config leaves the check's rule out of a checked file", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: RULE_ABSENT,
      governance,
    }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "not-included",
          projectionFile: "hone.eslint.mjs",
          slices: [],
        },
      },
      linted: [],
    });
  });

  it("names nested reach and keeps the parent config-override when both configurations omit a rule", async () => {
    const parent = repoPathOf("kept.ts");
    const overridden = repoPathOf("overridden.ts");
    const governance = lintingNothing();
    const outcome = await runnerOverQuery({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      fileText: createDefaultFileTextPort({}),
      query: {
        ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValue({
          outcome: "ok",
          value: "checked",
        }),
        ruleState: vi
          .fn<QueryInstance["ruleState"]>()
          .mockResolvedValueOnce({ outcome: "ok", value: CONFIGURED_ON })
          .mockResolvedValueOnce({ outcome: "ok", value: RULE_ABSENT })
          .mockResolvedValueOnce({ outcome: "ok", value: RULE_ABSENT }),
        configFileOf: vi.fn<QueryInstance["configFileOf"]>(),
      },
      governance,
    }).run({
      ...SELECTING_THE_CLASS_CHECK,
      files: [parent, NESTED_SOURCE, overridden],
      trackedPaths: [parent, NESTED_SETTINGS, NESTED_ESLINT, NESTED_SOURCE, overridden],
    });
    expect(outcome).toMatchObject({
      outcome: "ok",
      value: {
        projection: "current",
        nestedConfigurations: [NESTED_FOLDER],
        unprojectedFolders: [{ folder: NESTED_FOLDER, selectionFolder: NESTED_FOLDER }],
        nativeExceptions: [
          {
            kind: "config-override",
            check: "authored-class-or-this#class-keyword",
            file: overridden,
          },
        ],
      },
    });
    expect(vi.mocked(governance.lintFiles).mock.calls).toEqual([
      [{ files: [parent, NESTED_SOURCE, overridden] }],
    ]);
  });

  it("reports no nested projection reach when ESLint uses the repository root config", async () => {
    const fileText = createDefaultFileTextPort({});
    const outcome = await runnerOverProjectionReading({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
      fileText: {
        ...fileText,
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      },
    }).run({
      ...SELECTING_THE_CLASS_CHECK,
      declaredConfigLookup: "repository-root",
      projectionKind: "mjs",
      files: [NESTED_SOURCE],
      trackedPaths: [NESTED_SETTINGS, NESTED_ESLINT, NESTED_SOURCE],
    });
    expect(outcome).toMatchObject({
      outcome: "ok",
      value: { projection: "current", nestedConfigurations: [], unprojectedFolders: [] },
    });
  });
});

const PACKAGE_SLICE_PATH = repoPathOf("packages/web/hone.eslint.mjs");

const PACKAGE_DECLARATION_PATH = repoPathOf("packages/web/hone.eslint.d.mts");

const ROOT_DECLARATION = { kind: "write", file: CHECKS_DECLARATION_PATH, text: DECLARATION_TEXT };

const PACKAGE_DECLARATION = {
  kind: "write",
  file: PACKAGE_DECLARATION_PATH,
  text: DECLARATION_TEXT,
};

const PACKAGE_PROJECTION_TEXT = checksProjectionText({
  kind: "mjs",
  pluginImport: "../../../../src/eslint-plugin.ts",
  checks: [CLASS_PROJECTED],
  answered: [],
});

const PACKAGE_PROJECTION_PRESENT: CurrentProjection = {
  presence: "present",
  text: PACKAGE_PROJECTION_TEXT,
};

const WITH_A_PACKAGE_CONFIG: NamedEslintRunRequest = {
  ...SELECTING_THE_CLASS_CHECK,
  trackedPaths: [repoPathOf("kept.ts"), repoPathOf("packages/web/eslint.config.mjs")],
};

const slicesHolding = (request: {
  readonly root: CurrentProjection;
  readonly web: CurrentProjection;
}): ReadonlyMap<RepoPath, CurrentProjection> =>
  new Map([
    [CHECKS_PROJECTION_PATH, request.root],
    [PACKAGE_SLICE_PATH, request.web],
    [CHECKS_DECLARATION_PATH, DECLARATION_PRESENT],
    [PACKAGE_DECLARATION_PATH, DECLARATION_PRESENT],
  ]);

const runOverSlices = (request: {
  readonly root: CurrentProjection;
  readonly web: CurrentProjection;
}) =>
  runnerOverProjection({
    currents: slicesHolding(request),
    ruleState: CONFIGURED_ON,
    governance: lintingNothing(),
  }).run(WITH_A_PACKAGE_CONFIG);

describe("checksRunnerOver, over a repository holding a package eslint.config.*", () => {
  it("reports the projection current, and no slice problem, when the root file and the package's file both hold what project writes", async () => {
    expect(
      await runOverSlices({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PACKAGE_PROJECTION_PRESENT,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    });
  });

  it("names the package's file out of date, beside a current root file, when only the package's file differs", async () => {
    expect(
      await runOverSlices({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PROJECTION_THAT_DIFFERS,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [{ file: PACKAGE_SLICE_PATH, state: "out-of-date" }],
      },
    });
  });

  it("names the package's file out of date, not the projection not included, and lints nothing, when only the package's file differs and the team's config leaves the rule out of a checked file", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: slicesHolding({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PROJECTION_THAT_DIFFERS,
      }),
      ruleState: RULE_ABSENT,
      governance,
    }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [{ file: PACKAGE_SLICE_PATH, state: "out-of-date" }],
        },
      },
      linted: [],
    });
  });

  it("names the package's file missing, beside an out-of-date root file, when the package's file is not written and the root file differs", async () => {
    expect(
      await runOverSlices({ root: PROJECTION_THAT_DIFFERS, web: PROJECTION_NOT_WRITTEN }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "out-of-date",
        projectionFile: "hone.eslint.mjs",
        slices: [{ file: PACKAGE_SLICE_PATH, state: "missing" }],
      },
    });
  });

  it("reports the root file out of date, and no slice problem, when the root file differs and the package's file is current", async () => {
    expect(
      await runOverSlices({ root: PROJECTION_THAT_DIFFERS, web: PACKAGE_PROJECTION_PRESENT }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "out-of-date",
        projectionFile: "hone.eslint.mjs",
        slices: [],
      },
    });
  });

  it("reports the root file missing, and the package's file current, when only the root file is not written", async () => {
    expect(
      await runOverSlices({ root: PROJECTION_NOT_WRITTEN, web: PACKAGE_PROJECTION_PRESENT }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "missing",
        projectionFile: "hone.eslint.mjs",
        slices: [],
      },
    });
  });

  it("names the root declaration missing, and lints nothing, when only hone.eslint.d.mts is not written", async () => {
    const governance = lintingNothing();
    const currents = new Map(
      slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT }),
    ).set(CHECKS_DECLARATION_PATH, PROJECTION_NOT_WRITTEN);
    const outcome = await runnerOverProjection({
      currents,
      ruleState: CONFIGURED_ON,
      governance,
    }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [{ file: CHECKS_DECLARATION_PATH, state: "missing" }],
        },
      },
      linted: [],
    });
  });

  it("names a package's declaration out of date, and still lints the files, when it differs from what project writes", async () => {
    const governance = lintingNothing();
    const currents = new Map(
      slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT }),
    ).set(PACKAGE_DECLARATION_PATH, {
      presence: "present",
      text: `${DECLARATION_TEXT}\n`,
    });
    const outcome = await runnerOverProjection({
      currents,
      ruleState: CONFIGURED_ON,
      governance,
    }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [{ file: PACKAGE_DECLARATION_PATH, state: "out-of-date" }],
        },
      },
      linted: [[{ files: WITH_A_PACKAGE_CONFIG.files }]],
    });
  });

  it("queries and lints every file it is given, whatever its name", async () => {
    const authored = [
      repoPathOf("kept.ts"),
      repoPathOf("hone.walker.mts"),
      repoPathOf("src/hone.eslint.d.mts"),
      repoPathOf("packages/old/hone.eslint.d.mts"),
    ];
    const governance = lintingNothing();
    const query = queryInstanceOver(CONFIGURED_ON);
    const projecting = runnerOverQuery({
      currents: slicesHolding({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PACKAGE_PROJECTION_PRESENT,
      }),
      fileText: createDefaultFileTextPort({}),
      query,
      governance,
    });

    const outcome = await projecting.run({ ...WITH_A_PACKAGE_CONFIG, files: authored });

    expect({
      outcome,
      linted: vi.mocked(governance.lintFiles).mock.calls,
    }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [],
        },
      },
      linted: [[{ files: authored }]],
    });
    expect(query.ignoredState).toHaveBeenCalledTimes(4);
  });

  it("names a declaration it compares out of date when it was altered, and lints it when it is given as an input", async () => {
    const governance = lintingNothing();
    const currents = new Map(
      slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT }),
    ).set(CHECKS_DECLARATION_PATH, { presence: "present", text: "export default [];" });
    const projecting = runnerOverProjection({ currents, ruleState: CONFIGURED_ON, governance });

    const outcome = await projecting.run({
      ...WITH_A_PACKAGE_CONFIG,
      files: [CHECKS_DECLARATION_PATH],
    });

    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [{ file: CHECKS_DECLARATION_PATH, state: "out-of-date" }],
        },
      },
      linted: [[{ files: [CHECKS_DECLARATION_PATH] }]],
    });
  });

  it("reports the projection current when it is given no file to check", async () => {
    const governance = lintingNothing();
    const projecting = runnerOverProjection({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: CONFIGURED_ON,
      governance,
    });

    const outcome = await projecting.run({
      ...SELECTING_THE_CLASS_CHECK,
      files: [],
      trackedPaths: [],
    });

    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [],
        },
      },
      linted: [[{ files: [] }]],
    });
  });

  it("lints nothing when a package's file is not written, and names it", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: slicesHolding({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PROJECTION_NOT_WRITTEN,
      }),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [{ file: PACKAGE_SLICE_PATH, state: "missing" }],
        },
      },
      linted: [],
    });
  });

  it("still lints the files when a package's file is out of date, and names it", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: slicesHolding({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PROJECTION_THAT_DIFFERS,
      }),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [{ file: PACKAGE_SLICE_PATH, state: "out-of-date" }],
        },
      },
      linted: [[{ files: WITH_A_PACKAGE_CONFIG.files }]],
    });
  });

  it("names a declared folder's file missing, and unconfigured, when it holds no eslint.config.* on disk and its file is not written", async () => {
    const request = {
      ...SELECTING_THE_CLASS_CHECK,
      declaredConfigRoots: [repoPathOf("packages/web")],
    };
    const outcome = await runnerOverProjection({
      currents: slicesHolding({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PROJECTION_NOT_WRITTEN,
      }),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
    }).run(request);
    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [
          { file: PACKAGE_SLICE_PATH, state: "missing" },
          { file: PACKAGE_SLICE_PATH, state: "unconfigured" },
        ],
      },
    });
  });

  it("names a declared folder's file unconfigured, and still lints, when the file is written but the folder holds no eslint.config.* on disk", async () => {
    const governance = lintingNothing();
    const request = {
      ...SELECTING_THE_CLASS_CHECK,
      declaredConfigRoots: [repoPathOf("packages/web")],
    };
    const outcome = await runnerOverProjection({
      currents: slicesHolding({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PACKAGE_PROJECTION_PRESENT,
      }),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(request);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          projection: "current",
          slices: [{ file: PACKAGE_SLICE_PATH, state: "unconfigured" }],
        },
      },
      linted: [[{ files: request.files }]],
    });
  });

  it("names no declared folder unconfigured when it holds an eslint.config.* on disk, whatever the lookup", async () => {
    const present = {
      ...createDefaultFileTextPort({}),
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("absent")
        .mockReturnValueOnce("absent")
        .mockReturnValue("present"),
    };
    const request = {
      ...SELECTING_THE_CLASS_CHECK,
      declaredConfigRoots: [repoPathOf("packages/web")],
    };
    const outcome = await runnerOverProjectionReading({
      currents: slicesHolding({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PACKAGE_PROJECTION_PRESENT,
      }),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
      fileText: present,
    }).run(request);
    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    });
  });

  it("names a folder unconfigured only when it is declared, not when a tracked eslint.config.* is merely absent from disk", async () => {
    const outcome = await runOverSlices({
      root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
      web: PACKAGE_PROJECTION_PRESENT,
    });
    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    });
  });

  it("reads the installed ESLint version once for the whole run, not once for its slices and again for its query", async () => {
    const declaring = createDefaultFileTextPort({});
    const detecting = createDefaultFileTextPort({});
    const declaringRead = vi.spyOn(declaring, "read");
    const detectingRead = vi.spyOn(detecting, "read");
    const stubs = {
      currents: slicesHolding({
        root: PROJECTION_WRITTEN_AS_PROJECT_WOULD,
        web: PACKAGE_PROJECTION_PRESENT,
      }),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
    };
    await runnerOverProjectionReading({ ...stubs, fileText: declaring }).run({
      ...WITH_A_PACKAGE_CONFIG,
      declaredConfigLookup: "nearest-to-file",
      projectionKind: "mjs",
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });
    await runnerOverProjectionReading({ ...stubs, fileText: detecting }).run({
      ...WITH_A_PACKAGE_CONFIG,
      declaredConfigLookup: undefined,
      projectionKind: "mjs",
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });
    expect({
      declared: declaringRead.mock.calls,
      detecting: detectingRead.mock.calls,
    }).toEqual({
      declared: [[{ path: CLASS_PIECE_JSON }]],
      detecting: [[{ path: INSTALLED_ESLINT_PACKAGE_JSON }], [{ path: CLASS_PIECE_JSON }]],
    });
  });

  it("reads no slice for a declared folder that is a nested repository", async () => {
    const request = {
      ...SELECTING_THE_CLASS_CHECK,
      declaredConfigRoots: [repoPathOf("vendor/lib")],
      trackedPaths: [repoPathOf("kept.ts"), repoPathOf("vendor/lib/hone.config.json")],
    };
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
    }).run(request);
    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    });
  });

  it("reads no slice for a nested repository's lint config, when the nested repository holds no file to check", async () => {
    const request = {
      ...SELECTING_THE_CLASS_CHECK,
      trackedPaths: [
        repoPathOf("kept.ts"),
        repoPathOf("vendor/lib/hone.config.json"),
        repoPathOf("vendor/lib/eslint.config.mjs"),
      ],
    };
    const outcome = await runnerOverProjection({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
    }).run(request);
    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    });
  });
});

const projectingRunner = (fileText: FileTextPort = createDefaultFileTextPort({})) => {
  const realModules = createDefaultModuleLoaderPort({});
  const repositoryAt = vi.fn<ChecksRunnerPorts["repositoryAt"]>();
  const runnerOver = checksRunnerOver({
    ports: {
      repositoryAt,
      coreInstall: vi
        .fn<ChecksRunnerPorts["coreInstall"]>()
        .mockReturnValue({ outcome: "ok", value: { form: "source" } }),
      modules: realModules,
      path,
      eslint,
    },
    platform: {
      fileText,
      fileRemoval: createDefaultFileRemovalPort({}),
      modules: realModules,
      path,
      eslint,
      moduleExtension: ".ts",
    },
  });
  return { runnerOver, repositoryAt };
};

describe("checksRunnerOver, giving the ts projection kind as project", () => {
  it("gives hone.eslint.ts typed by the boundary, and no declaration", async () => {
    const { runnerOver } = projectingRunner();

    const outcome = await runnerOver.project({
      ...SELECTING_THE_CLASS_CHECK,
      projectionKind: "ts",
    });

    expect(outcome).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "write",
          file: "hone.eslint.ts",
          text: 'import hone from "../../src/eslint-plugin.ts";\nconst projection: {\n  name: string;\n  files: string[];\n  ignores?: string[];\n  plugins?: Record<string, object>;\n  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;\n}[] = [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.ts"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } }];\nexport default projection;\n',
        },
      ],
    });
  });

  it("gives one hone.eslint.ts for each package slice beside the root's, and no declarations", async () => {
    const { runnerOver } = projectingRunner();

    const outcome = await runnerOver.project({ ...WITH_A_PACKAGE_CONFIG, projectionKind: "ts" });

    expect(outcome).toEqual({
      outcome: "ok",
      value: [
        { kind: "write", file: "hone.eslint.ts", text: expect.any(String) },
        { kind: "write", file: "packages/web/hone.eslint.ts", text: expect.any(String) },
      ],
    });
  });
});

const filesPresent = (files: readonly RepoPath[]): FileTextPort => {
  const fileText = createDefaultFileTextPort({});
  const paths = new Set(files.map((file) => path.join({ segments: [SCRATCH_REPO_ROOT, file] })));
  return {
    ...fileText,
    exists: (location) => (paths.has(location.path) ? "present" : fileText.exists(location)),
  };
};

describe("checksRunnerOver, removing alternate projection files", () => {
  it("returns removal entries only for existing alternate files in the selected config roots", async () => {
    const { runnerOver } = projectingRunner(
      filesPresent([repoPathOf("hone.eslint.mjs"), repoPathOf("packages/web/hone.eslint.d.mts")]),
    );

    const outcome = await runnerOver.project({ ...WITH_A_PACKAGE_CONFIG, projectionKind: "ts" });

    expect(outcome).toEqual({
      outcome: "ok",
      value: [
        { kind: "write", file: "hone.eslint.ts", text: expect.any(String) },
        { kind: "write", file: "packages/web/hone.eslint.ts", text: expect.any(String) },
        { kind: "remove", file: "hone.eslint.mjs" },
        { kind: "remove", file: "packages/web/hone.eslint.d.mts" },
      ],
    });
  });

  it("reports an obsolete projection file even without the file in the run request", async () => {
    const runner = runnerOverProjectionReading({
      currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
      fileText: filesPresent([repoPathOf("hone.eslint.ts")]),
    });

    const outcome = await runner.run(SELECTING_THE_CLASS_CHECK);

    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        projection: "current",
        slices: [{ file: "hone.eslint.ts", state: "left-over" }],
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
      },
    });
  });
});

describe("checksRunnerOver, giving the projection as project", () => {
  it("gives exactly the text a run compares against, for hone.eslint.mjs, and touches no repository", async () => {
    const { runnerOver, repositoryAt } = projectingRunner();
    expect({
      outcome: await runnerOver.project(SELECTING_THE_CLASS_CHECK),
      touched: repositoryAt.mock.calls,
    }).toEqual({
      outcome: {
        outcome: "ok",
        value: [
          { kind: "write", file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
          ROOT_DECLARATION,
        ],
      },
      touched: [],
    });
  });

  it("gives the same files when it projects again over a tree that holds what it projected", async () => {
    const { runnerOver } = projectingRunner();
    const first = await runnerOver.project(WITH_A_PACKAGE_CONFIG);

    const second = await runnerOver.project({
      ...WITH_A_PACKAGE_CONFIG,
      trackedPaths: [
        ...WITH_A_PACKAGE_CONFIG.trackedPaths,
        CHECKS_PROJECTION_PATH,
        PACKAGE_SLICE_PATH,
        CHECKS_DECLARATION_PATH,
        PACKAGE_DECLARATION_PATH,
      ],
    });

    expect(second).toEqual(first);
  });

  it("gives the answered files as off blocks, so records change the projection", async () => {
    const { runnerOver } = projectingRunner();
    const answered = [
      {
        ruleSet: TOOL_RULE_SET,
        symptom: "authored-class-or-this",
        check: "class-keyword",
        file: repoPathOf("kept.ts"),
      },
    ];
    expect(await runnerOver.project({ ...SELECTING_THE_CLASS_CHECK, answered })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "write",
          file: CHECKS_PROJECTION_PATH,
          text: checksProjectionText({
            kind: "mjs",
            pluginImport: "../../src/eslint-plugin.ts",
            checks: [CLASS_PROJECTED],
            answered,
          }),
        },
        ROOT_DECLARATION,
      ],
    });
  });

  it("gives a file beside each package eslint.config.*, importing the plugin from its own folder, and the declaration of each file's type", async () => {
    expect(await projectingRunner().runnerOver.project(WITH_A_PACKAGE_CONFIG)).toEqual({
      outcome: "ok",
      value: [
        { kind: "write", file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        { kind: "write", file: PACKAGE_SLICE_PATH, text: PACKAGE_PROJECTION_TEXT },
        ROOT_DECLARATION,
        PACKAGE_DECLARATION,
      ],
    });
  });

  it("gives each package's file only the answers under that package, relative to it, and the root file all of them", async () => {
    const answered = [
      {
        ruleSet: TOOL_RULE_SET,
        symptom: "authored-class-or-this",
        check: "class-keyword",
        file: repoPathOf("kept.ts"),
      },
      {
        ruleSet: TOOL_RULE_SET,
        symptom: "authored-class-or-this",
        check: "class-keyword",
        file: repoPathOf("packages/web/src/a.ts"),
      },
    ];
    const rooted = [
      {
        ruleSet: TOOL_RULE_SET,
        symptom: "authored-class-or-this",
        check: "class-keyword",
        file: repoPathOf("src/a.ts"),
      },
    ];
    expect(
      await projectingRunner().runnerOver.project({ ...WITH_A_PACKAGE_CONFIG, answered }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "write",
          file: CHECKS_PROJECTION_PATH,
          text: checksProjectionText({
            kind: "mjs",
            pluginImport: "../../src/eslint-plugin.ts",
            checks: [CLASS_PROJECTED],
            answered,
          }),
        },
        {
          kind: "write",
          file: PACKAGE_SLICE_PATH,
          text: checksProjectionText({
            kind: "mjs",
            pluginImport: "../../../../src/eslint-plugin.ts",
            checks: [CLASS_PROJECTED],
            answered: rooted,
          }),
        },
        ROOT_DECLARATION,
        PACKAGE_DECLARATION,
      ],
    });
  });

  it("gives only the root file for a package config under a repository-root lookup", async () => {
    expect(
      await projectingRunner().runnerOver.project({
        ...WITH_A_PACKAGE_CONFIG,
        declaredConfigLookup: "repository-root",
        projectionKind: "mjs",
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "write", file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        ROOT_DECLARATION,
      ],
    });
  });

  it("gives no files when no check runs on ESLint", async () => {
    expect(await projectingRunner().runnerOver.project(REQUEST)).toEqual({
      outcome: "ok",
      value: [],
    });
  });

  it("gives a file in a declared folder that holds no eslint.config.*, beside the root file", async () => {
    expect(
      await projectingRunner().runnerOver.project({
        ...SELECTING_THE_CLASS_CHECK,
        declaredConfigRoots: [repoPathOf("packages/web")],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "write", file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        { kind: "write", file: PACKAGE_SLICE_PATH, text: PACKAGE_PROJECTION_TEXT },
        ROOT_DECLARATION,
        PACKAGE_DECLARATION,
      ],
    });
  });

  it("gives one file for a folder that is both declared and holds an eslint.config.*", async () => {
    expect(
      await projectingRunner().runnerOver.project({
        ...WITH_A_PACKAGE_CONFIG,
        declaredConfigRoots: [repoPathOf("packages/web")],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "write", file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        { kind: "write", file: PACKAGE_SLICE_PATH, text: PACKAGE_PROJECTION_TEXT },
        ROOT_DECLARATION,
        PACKAGE_DECLARATION,
      ],
    });
  });

  it("gives no file for a declared folder that is a nested repository", async () => {
    expect(
      await projectingRunner().runnerOver.project({
        ...SELECTING_THE_CLASS_CHECK,
        declaredConfigRoots: [NESTED_FOLDER],
        files: [NESTED_SOURCE],
        trackedPaths: [NESTED_SETTINGS, NESTED_ESLINT, NESTED_SOURCE],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "write", file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        ROOT_DECLARATION,
      ],
    });
  });

  it("gives the text a run then reports as current, so the two read one source", async () => {
    const governance = lintingNothing();
    const projected = await projectingRunner().runnerOver.project(SELECTING_THE_CLASS_CHECK);
    assert(projected.outcome === "ok", "the projection is given");
    const [file, declaration] = projected.value;
    assert(file !== undefined, "the projection is given");
    assert(file.kind === "write", "the projection is a write");
    assert(declaration !== undefined, "its declaration is given");
    assert(declaration.kind === "write", "the declaration is a write");
    const currents = new Map<RepoPath, CurrentProjection>([
      [file.file, { presence: "present", text: file.text }],
      [declaration.file, { presence: "present", text: declaration.text }],
    ]);
    const outcome = await runnerOverProjection({
      currents,
      ruleState: CONFIGURED_ON,
      governance,
    }).run(SELECTING_THE_CLASS_CHECK);
    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [],
      },
    });
  });
});

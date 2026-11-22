import { assert, describe, expect, it, vi } from "vitest";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { RuledCheck } from "../hone-plugin/check-rule-id.ts";
import ESLINT_CD_14_PIECE from "../../CD-14/piece.json" with { type: "json" };
import { CHECKS_DECLARATION_PATH, CHECKS_PROJECTION_PATH, checksProjectionText } from "../projection/checks-projection.ts";
import type { ChecksRepository } from "./checks-repository.ts";
import type { ChecksRunRequest } from "./checks-run-types.ts";
import { checksRunnerOver } from "./checks-runner.ts";
import type { ChecksRunnerPorts } from "./checks-ports.ts";
import type { RuleState } from "../toolchain/eslint-config-schema.ts";
import type { EslintPort, GovernanceInstance, QueryInstance } from "../toolchain/eslint-instance.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import type { CurrentProjection, ProjectionFiles } from "../projection/projection.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";

const DECLARATION_TEXT = "declare const projection: readonly unknown[];\nexport default projection;\n";

const SILENT_BOUNDARY: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: () => undefined,
  declarationText: DECLARATION_TEXT,
};

type CountedReads = {
  readonly fileText: FileTextPort;
  readonly readsOf: (request: { readonly path: string }) => number;
};

const countedReadsOver = (request: { readonly fileText: FileTextPort }): CountedReads => {
  const counts = new Map<string, number>();
  return {
    fileText: {
      ...request.fileText,
      read: (asked) => {
        counts.set(asked.path, (counts.get(asked.path) ?? 0) + 1);
        return request.fileText.read(asked);
      },
    },
    readsOf: ({ path }) => counts.get(path) ?? 0,
  };
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
  ports: { repositoryAt: vi.fn<ChecksRunnerPorts["repositoryAt"]>(), coreInstall: vi.fn<ChecksRunnerPorts["coreInstall"]>(), modules, path, eslint },
  platform: { fileText: createDefaultFileTextPort({}), fileRemoval: createDefaultFileRemovalPort({}), modules, path, eslint, moduleExtension: ".ts" },
});

const REQUEST: ChecksRunRequest = {
  repoRoot: absoluteRootOf("/repo"),
  installRoot: absoluteRootOf("/install"),
  files: [repoPathOf("src/a.ts")],
  trackedPaths: [repoPathOf("src/a.ts")],
  checks: [],
  bindings: [],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
};

const NOT_READY_NESTED = { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["vendor/lib"] } } };

describe("checksRunnerOver", () => {
  it("is not ready for a repository holding a nested repository with files to check", async () => {
    expect(
      await runner.run({
        ...REQUEST,
        files: [repoPathOf("vendor/lib/src/a.ts")],
        trackedPaths: [repoPathOf("vendor/lib/hone.config.json"), repoPathOf("vendor/lib/src/a.ts")],
      }),
    ).toEqual(NOT_READY_NESTED);
  });

  it("names the nested repository, and not its own lint config as a package config of this one, when that repository holds one", async () => {
    expect(
      await runner.run({
        ...REQUEST,
        files: [repoPathOf("vendor/lib/src/a.ts")],
        trackedPaths: [
          repoPathOf("vendor/lib/hone.config.json"),
          repoPathOf("vendor/lib/eslint.config.mjs"),
          repoPathOf("vendor/lib/src/a.ts"),
        ],
      }),
    ).toEqual(NOT_READY_NESTED);
  });

  it("reports a current projection and no findings when no check runs on ESLint", async () => {
    expect(await runner.run(REQUEST)).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [] },
    });
  });
});

const REAL_INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const SCRATCH_REPO_ROOT = absolutePathSchema.parse(`${REAL_INSTALL_ROOT}/artefacts/scratch`);

const INSTALLED_ESLINT_PACKAGE_JSON = path.join({ segments: [SCRATCH_REPO_ROOT, "node_modules", "eslint", "package.json"] });

const CLASS_KEYWORD_CHECK: RuledCheck = {
  name: "class-keyword",
  symptom: { name: "authored-class-or-this", title: "Authored class or this" },
  clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") },
  engines: [{ mechanism: "audit" }, { mechanism: "eslint" }],
};

const CLASS_PROJECTED = { symptom: "authored-class-or-this", check: "class-keyword", ruleId: "hone/authored-class-or-this#class-keyword", options: [] };

const CURRENT_PROJECTION_TEXT = checksProjectionText({ pluginImport: "../../src/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered: [] });

const CLASS_BINDINGS: ChecksRunRequest["bindings"] = [
  {
    mechanism: "eslint",
    clause: {
      address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") },
      pieceRoot: `${REAL_INSTALL_ROOT}/src/infrastructure/engines/eslint/CD-14`,
      settings: ESLINT_CD_14_PIECE.clauses[0].settings,
    },
  },
];

const SELECTING_THE_CLASS_CHECK: ChecksRunRequest = {
  repoRoot: SCRATCH_REPO_ROOT,
  installRoot: REAL_INSTALL_ROOT,
  files: [repoPathOf("kept.ts")],
  trackedPaths: [repoPathOf("kept.ts")],
  checks: [CLASS_KEYWORD_CHECK],
  bindings: CLASS_BINDINGS,
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: "nearest-to-file",
};

const CONFIGURED_ON: RuleState = { state: "configured", severity: 2, options: [] };

const RULE_ABSENT: RuleState = { state: "rule-absent" };

const PROJECTION_WRITTEN_AS_PROJECT_WOULD: CurrentProjection = { presence: "present", text: CURRENT_PROJECTION_TEXT };

const PROJECTION_THAT_DIFFERS: CurrentProjection = { presence: "present", text: `${CURRENT_PROJECTION_TEXT}\n` };

const PROJECTION_NOT_WRITTEN: CurrentProjection = { presence: "absent" };

const DECLARATION_PRESENT: CurrentProjection = { presence: "present", text: DECLARATION_TEXT };

const rootOnly = (current: CurrentProjection): ReadonlyMap<RepoPath, CurrentProjection> =>
  new Map([
    [CHECKS_PROJECTION_PATH, current],
    [CHECKS_DECLARATION_PATH, DECLARATION_PRESENT],
  ]);

const projectionFilesHolding = (currents: ReadonlyMap<RepoPath, CurrentProjection>): ProjectionFiles => ({
  currentOf: vi.fn<ProjectionFiles["currentOf"]>().mockReturnValue({ outcome: "ok", value: currents }),
  writeAt: vi.fn<ProjectionFiles["writeAt"]>(),
  removeAt: vi.fn<ProjectionFiles["removeAt"]>(),
});

const repositoryHolding = (currents: ReadonlyMap<RepoPath, CurrentProjection>): ChecksRepository => ({
  projectionFiles: projectionFilesHolding(currents),
  packageScriptsAt: vi.fn<ChecksRepository["packageScriptsAt"]>(),
  suppressionsAt: vi.fn<ChecksRepository["suppressionsAt"]>(),
  sourceLines: vi.fn<ChecksRepository["sourceLines"]>(),
});

const queryInstanceOver = (ruleState: RuleState): QueryInstance => ({
  ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValue({ outcome: "ok", value: "checked" }),
  ruleState: vi.fn<QueryInstance["ruleState"]>().mockResolvedValue({ outcome: "ok", value: ruleState }),
  configFileOf: vi.fn<QueryInstance["configFileOf"]>(),
});

const lintingNothing = (): GovernanceInstance => ({
  lintFiles: vi.fn<GovernanceInstance["lintFiles"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

type ProjectionStubs = { readonly currents: ReadonlyMap<RepoPath, CurrentProjection>; readonly ruleState: RuleState; readonly governance: GovernanceInstance };

const runnerOverProjectionReading = (stubs: ProjectionStubs & { readonly fileText: FileTextPort }) => {
  const realModules = createDefaultModuleLoaderPort({});
  const stubbedEslint: EslintPort = {
    boundary: SILENT_BOUNDARY,
    createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>().mockReturnValue(queryInstanceOver(stubs.ruleState)),
    createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>().mockReturnValue(stubs.governance),
    ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>(),
    ignoredByPatterns: vi.fn<EslintPort["ignoredByPatterns"]>(),
    lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
  };
  return checksRunnerOver({
    ports: {
      repositoryAt: vi.fn<ChecksRunnerPorts["repositoryAt"]>().mockReturnValue(repositoryHolding(stubs.currents)),
      coreInstall: vi.fn<ChecksRunnerPorts["coreInstall"]>().mockReturnValue({ outcome: "ok", value: { form: "source" } }),
      modules: realModules,
      path,
      eslint: stubbedEslint,
    },
    platform: { fileText: stubs.fileText, fileRemoval: createDefaultFileRemovalPort({}), modules: realModules, path, eslint: stubbedEslint, moduleExtension: ".ts" },
  });
};

const runnerOverProjection = (stubs: ProjectionStubs) => runnerOverProjectionReading({ ...stubs, fileText: createDefaultFileTextPort({}) });

describe("checksRunnerOver, reporting the state of hone.eslint.mjs from the repository's reader", () => {
  it("reports a missing projection, and lints nothing, when hone.eslint.mjs is not written", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_NOT_WRITTEN), ruleState: CONFIGURED_ON, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "missing", slices: [] } },
      linted: [],
    });
  });

  it("reports an out-of-date projection, and still lints the files, when hone.eslint.mjs differs from what project would write", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_THAT_DIFFERS), ruleState: CONFIGURED_ON, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "out-of-date", slices: [] } },
      linted: [[{ files: SELECTING_THE_CLASS_CHECK.files }]],
    });
  });

  it("reports the projection current, and lints the files, when hone.eslint.mjs is what project would write and the team's config enables the check", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD), ruleState: CONFIGURED_ON, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [] } },
      linted: [[{ files: SELECTING_THE_CLASS_CHECK.files }]],
    });
  });

  it("reports the projection out of date, and lints nothing, when it differs from what project would write and the team's config leaves the check's rule out of a checked file", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_THAT_DIFFERS), ruleState: RULE_ABSENT, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "out-of-date", slices: [] } },
      linted: [],
    });
  });

  it("reports the projection not included, and lints nothing, when the team's config leaves the check's rule out of a checked file", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD), ruleState: RULE_ABSENT, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "not-included", slices: [] } },
      linted: [],
    });
  });
});

const PACKAGE_SLICE_PATH = repoPathOf("packages/web/hone.eslint.mjs");

const PACKAGE_DECLARATION_PATH = repoPathOf("packages/web/hone.eslint.d.mts");

const ROOT_DECLARATION = { file: CHECKS_DECLARATION_PATH, text: DECLARATION_TEXT };

const PACKAGE_DECLARATION = { file: PACKAGE_DECLARATION_PATH, text: DECLARATION_TEXT };

const PACKAGE_PROJECTION_TEXT = checksProjectionText({ pluginImport: "../../../../src/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered: [] });

const PACKAGE_PROJECTION_PRESENT: CurrentProjection = { presence: "present", text: PACKAGE_PROJECTION_TEXT };

const WITH_A_PACKAGE_CONFIG: ChecksRunRequest = {
  ...SELECTING_THE_CLASS_CHECK,
  trackedPaths: [repoPathOf("kept.ts"), repoPathOf("packages/web/eslint.config.mjs")],
};

const slicesHolding = (request: { readonly root: CurrentProjection; readonly web: CurrentProjection }): ReadonlyMap<RepoPath, CurrentProjection> =>
  new Map([
    [CHECKS_PROJECTION_PATH, request.root],
    [PACKAGE_SLICE_PATH, request.web],
    [CHECKS_DECLARATION_PATH, DECLARATION_PRESENT],
    [PACKAGE_DECLARATION_PATH, DECLARATION_PRESENT],
  ]);

const runOverSlices = (request: { readonly root: CurrentProjection; readonly web: CurrentProjection }) =>
  runnerOverProjection({ currents: slicesHolding(request), ruleState: CONFIGURED_ON, governance: lintingNothing() }).run(WITH_A_PACKAGE_CONFIG);

describe("checksRunnerOver, over a repository holding a package eslint.config.*", () => {
  it("reports the projection current, and no slice problem, when the root file and the package's file both hold what project writes", async () => {
    expect(await runOverSlices({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT })).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [] },
    });
  });

  it("names the package's file out of date, beside a current root file, when only the package's file differs", async () => {
    expect(await runOverSlices({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PROJECTION_THAT_DIFFERS })).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [{ slice: PACKAGE_SLICE_PATH, state: "out-of-date" }] },
    });
  });

  it("names the package's file out of date, not the projection not included, and lints nothing, when only the package's file differs and the team's config leaves the rule out of a checked file", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PROJECTION_THAT_DIFFERS }),
      ruleState: RULE_ABSENT,
      governance,
    }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [{ slice: PACKAGE_SLICE_PATH, state: "out-of-date" }] } },
      linted: [],
    });
  });

  it("names the package's file missing, beside an out-of-date root file, when the package's file is not written and the root file differs", async () => {
    expect(await runOverSlices({ root: PROJECTION_THAT_DIFFERS, web: PROJECTION_NOT_WRITTEN })).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "out-of-date", slices: [{ slice: PACKAGE_SLICE_PATH, state: "missing" }] },
    });
  });

  it("reports the root file out of date, and no slice problem, when the root file differs and the package's file is current", async () => {
    expect(await runOverSlices({ root: PROJECTION_THAT_DIFFERS, web: PACKAGE_PROJECTION_PRESENT })).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "out-of-date", slices: [] },
    });
  });

  it("reports the root file missing, and the package's file current, when only the root file is not written", async () => {
    expect(await runOverSlices({ root: PROJECTION_NOT_WRITTEN, web: PACKAGE_PROJECTION_PRESENT })).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "missing", slices: [] },
    });
  });

  it("names the root declaration missing, and lints nothing, when only hone.eslint.d.mts is not written", async () => {
    const governance = lintingNothing();
    const currents = new Map(slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT })).set(CHECKS_DECLARATION_PATH, PROJECTION_NOT_WRITTEN);
    const outcome = await runnerOverProjection({ currents, ruleState: CONFIGURED_ON, governance }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [{ slice: CHECKS_DECLARATION_PATH, state: "missing" }] } },
      linted: [],
    });
  });

  it("names a package's declaration out of date, and still lints the files, when it differs from what project writes", async () => {
    const governance = lintingNothing();
    const currents = new Map(slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT })).set(PACKAGE_DECLARATION_PATH, {
      presence: "present",
      text: `${DECLARATION_TEXT}\n`,
    });
    const outcome = await runnerOverProjection({ currents, ruleState: CONFIGURED_ON, governance }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [{ slice: PACKAGE_DECLARATION_PATH, state: "out-of-date" }] } },
      linted: [[{ files: WITH_A_PACKAGE_CONFIG.files }]],
    });
  });

  it("lints nothing when a package's file is not written, and names it", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PROJECTION_NOT_WRITTEN }),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [{ slice: PACKAGE_SLICE_PATH, state: "missing" }] } },
      linted: [],
    });
  });

  it("still lints the files when a package's file is out of date, and names it", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({
      currents: slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PROJECTION_THAT_DIFFERS }),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(WITH_A_PACKAGE_CONFIG);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [{ slice: PACKAGE_SLICE_PATH, state: "out-of-date" }] } },
      linted: [[{ files: WITH_A_PACKAGE_CONFIG.files }]],
    });
  });

  it("names a declared folder's file missing, and unconfigured, when it holds no eslint.config.* on disk and its file is not written", async () => {
    const request = { ...SELECTING_THE_CLASS_CHECK, declaredConfigRoots: [repoPathOf("packages/web")] };
    const outcome = await runnerOverProjection({
      currents: slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PROJECTION_NOT_WRITTEN }),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
    }).run(request);
    expect(outcome).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [],
        measured: [],
        misnamedRuleIds: [],
        projection: "current",
        slices: [
          { slice: PACKAGE_SLICE_PATH, state: "missing" },
          { slice: PACKAGE_SLICE_PATH, state: "unconfigured" },
        ],
      },
    });
  });

  it("names a declared folder's file unconfigured, and still lints, when the file is written but the folder holds no eslint.config.* on disk", async () => {
    const governance = lintingNothing();
    const request = { ...SELECTING_THE_CLASS_CHECK, declaredConfigRoots: [repoPathOf("packages/web")] };
    const outcome = await runnerOverProjection({
      currents: slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT }),
      ruleState: CONFIGURED_ON,
      governance,
    }).run(request);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [{ slice: PACKAGE_SLICE_PATH, state: "unconfigured" }] } },
      linted: [[{ files: request.files }]],
    });
  });

  it("names no declared folder unconfigured when it holds an eslint.config.* on disk, whatever the lookup", async () => {
    const present = { ...createDefaultFileTextPort({}), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present") };
    const request = { ...SELECTING_THE_CLASS_CHECK, declaredConfigRoots: [repoPathOf("packages/web")] };
    const outcome = await runnerOverProjectionReading({
      currents: slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT }),
      ruleState: CONFIGURED_ON,
      governance: lintingNothing(),
      fileText: present,
    }).run(request);
    expect(outcome).toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [] } });
  });

  it("names a folder unconfigured only when it is declared, not when a tracked eslint.config.* is merely absent from disk", async () => {
    const outcome = await runOverSlices({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT });
    expect(outcome).toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [] } });
  });

  it("reads the installed ESLint version once for the whole run, not once for its slices and again for its query", async () => {
    const declaring = countedReadsOver({ fileText: createDefaultFileTextPort({}) });
    const detecting = countedReadsOver({ fileText: createDefaultFileTextPort({}) });
    const stubs = { currents: slicesHolding({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT }), ruleState: CONFIGURED_ON, governance: lintingNothing() };
    await runnerOverProjectionReading({ ...stubs, fileText: declaring.fileText }).run({ ...WITH_A_PACKAGE_CONFIG, declaredConfigLookup: "nearest-to-file" });
    await runnerOverProjectionReading({ ...stubs, fileText: detecting.fileText }).run({ ...WITH_A_PACKAGE_CONFIG, declaredConfigLookup: undefined });
    expect({ declared: declaring.readsOf({ path: INSTALLED_ESLINT_PACKAGE_JSON }), detecting: detecting.readsOf({ path: INSTALLED_ESLINT_PACKAGE_JSON }) }).toEqual({ declared: 0, detecting: 1 });
  });

  it("reads no slice for a declared folder that is a nested repository", async () => {
    const request = {
      ...SELECTING_THE_CLASS_CHECK,
      declaredConfigRoots: [repoPathOf("vendor/lib")],
      trackedPaths: [repoPathOf("kept.ts"), repoPathOf("vendor/lib/hone.config.json")],
    };
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD), ruleState: CONFIGURED_ON, governance: lintingNothing() }).run(request);
    expect(outcome).toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [] } });
  });

  it("reads no slice for a nested repository's lint config, when the nested repository holds no file to check", async () => {
    const request = {
      ...SELECTING_THE_CLASS_CHECK,
      trackedPaths: [repoPathOf("kept.ts"), repoPathOf("vendor/lib/hone.config.json"), repoPathOf("vendor/lib/eslint.config.mjs")],
    };
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD), ruleState: CONFIGURED_ON, governance: lintingNothing() }).run(request);
    expect(outcome).toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [] } });
  });
});

const projectingRunner = () => {
  const realModules = createDefaultModuleLoaderPort({});
  const repositoryAt = vi.fn<ChecksRunnerPorts["repositoryAt"]>();
  const runnerOver = checksRunnerOver({
    ports: {
      repositoryAt,
      coreInstall: vi.fn<ChecksRunnerPorts["coreInstall"]>().mockReturnValue({ outcome: "ok", value: { form: "source" } }),
      modules: realModules,
      path,
      eslint,
    },
    platform: { fileText: createDefaultFileTextPort({}), fileRemoval: createDefaultFileRemovalPort({}), modules: realModules, path, eslint, moduleExtension: ".ts" },
  });
  return { runnerOver, repositoryAt };
};

describe("checksRunnerOver, giving the projection as project", () => {
  it("gives exactly the text a run compares against, for hone.eslint.mjs, and touches no repository", async () => {
    const { runnerOver, repositoryAt } = projectingRunner();
    expect({ outcome: await runnerOver.project(SELECTING_THE_CLASS_CHECK), touched: repositoryAt.mock.calls }).toEqual({
      outcome: { outcome: "ok", value: [{ file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT }, ROOT_DECLARATION] },
      touched: [],
    });
  });

  it("gives the answered files as off blocks, so records change the projection", async () => {
    const { runnerOver } = projectingRunner();
    const answered = [{ symptom: "authored-class-or-this", check: "class-keyword", file: repoPathOf("kept.ts") }];
    expect(await runnerOver.project({ ...SELECTING_THE_CLASS_CHECK, answered })).toEqual({
      outcome: "ok",
      value: [{ file: CHECKS_PROJECTION_PATH, text: checksProjectionText({ pluginImport: "../../src/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered }) }, ROOT_DECLARATION],
    });
  });

  it("gives a file beside each package eslint.config.*, importing the plugin from its own folder, and the declaration of each file's type", async () => {
    expect(await projectingRunner().runnerOver.project(WITH_A_PACKAGE_CONFIG)).toEqual({
      outcome: "ok",
      value: [
        { file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        { file: PACKAGE_SLICE_PATH, text: PACKAGE_PROJECTION_TEXT },
        ROOT_DECLARATION,
        PACKAGE_DECLARATION,
      ],
    });
  });

  it("gives each package's file only the answers under that package, relative to it, and the root file all of them", async () => {
    const answered = [
      { symptom: "authored-class-or-this", check: "class-keyword", file: repoPathOf("kept.ts") },
      { symptom: "authored-class-or-this", check: "class-keyword", file: repoPathOf("packages/web/src/a.ts") },
    ];
    const rooted = [{ symptom: "authored-class-or-this", check: "class-keyword", file: repoPathOf("src/a.ts") }];
    expect(await projectingRunner().runnerOver.project({ ...WITH_A_PACKAGE_CONFIG, answered })).toEqual({
      outcome: "ok",
      value: [
        { file: CHECKS_PROJECTION_PATH, text: checksProjectionText({ pluginImport: "../../src/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered }) },
        { file: PACKAGE_SLICE_PATH, text: checksProjectionText({ pluginImport: "../../../../src/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered: rooted }) },
        ROOT_DECLARATION,
        PACKAGE_DECLARATION,
      ],
    });
  });

  it("gives only the root file for a package config under a repository-root lookup", async () => {
    expect(await projectingRunner().runnerOver.project({ ...WITH_A_PACKAGE_CONFIG, declaredConfigLookup: "repository-root" })).toEqual({
      outcome: "ok",
      value: [{ file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT }, ROOT_DECLARATION],
    });
  });

  it("gives no files when no check runs on ESLint", async () => {
    expect(await projectingRunner().runnerOver.project(REQUEST)).toEqual({ outcome: "ok", value: [] });
  });

  it("gives a file in a declared folder that holds no eslint.config.*, beside the root file", async () => {
    expect(await projectingRunner().runnerOver.project({ ...SELECTING_THE_CLASS_CHECK, declaredConfigRoots: [repoPathOf("packages/web")] })).toEqual({
      outcome: "ok",
      value: [
        { file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        { file: PACKAGE_SLICE_PATH, text: PACKAGE_PROJECTION_TEXT },
        ROOT_DECLARATION,
        PACKAGE_DECLARATION,
      ],
    });
  });

  it("gives one file for a folder that is both declared and holds an eslint.config.*", async () => {
    expect(await projectingRunner().runnerOver.project({ ...WITH_A_PACKAGE_CONFIG, declaredConfigRoots: [repoPathOf("packages/web")] })).toEqual({
      outcome: "ok",
      value: [
        { file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        { file: PACKAGE_SLICE_PATH, text: PACKAGE_PROJECTION_TEXT },
        ROOT_DECLARATION,
        PACKAGE_DECLARATION,
      ],
    });
  });

  it("gives no file for a declared folder that is a nested repository", async () => {
    expect(
      await projectingRunner().runnerOver.project({
        ...SELECTING_THE_CLASS_CHECK,
        declaredConfigRoots: [repoPathOf("vendor/lib")],
        trackedPaths: [repoPathOf("kept.ts"), repoPathOf("vendor/lib/hone.config.json")],
      }),
    ).toEqual({ outcome: "ok", value: [{ file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT }, ROOT_DECLARATION] });
  });

  it("gives the text a run then reports as current, so the two read one source", async () => {
    const governance = lintingNothing();
    const projected = await projectingRunner().runnerOver.project(SELECTING_THE_CLASS_CHECK);
    assert(projected.outcome === "ok", "the projection is given");
    const [file, declaration] = projected.value;
    assert(file !== undefined, "the projection is given");
    assert(declaration !== undefined, "its declaration is given");
    const currents = new Map<RepoPath, CurrentProjection>([
      [file.file, { presence: "present", text: file.text }],
      [declaration.file, { presence: "present", text: declaration.text }],
    ]);
    const outcome = await runnerOverProjection({ currents, ruleState: CONFIGURED_ON, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect(outcome).toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current", slices: [] } });
  });
});

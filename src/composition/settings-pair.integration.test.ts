import { assert, describe, expect, it, vi } from "vitest";

import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { readBoundCatalogue } from "../infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import {
  createSelectionRepository,
  readRunSettings,
} from "../infrastructure/disciplines-file/consumer-selection.ts";
import { runnerModuleAt } from "../infrastructure/engines/protocol/runner-module/runner-module-at.ts";
import { createSettingsSources } from "../infrastructure/hone-config-file/settings-sources.ts";
import { statedAuthorisedLocationWireSchema } from "../infrastructure/hone-records-folder/records-wire.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { runnerEnginesOver } from "./runner-engines.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

const RUNNER_ENGINES = runnerEnginesOver({ runnerModuleOf: runnerModuleAt });

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const INSTALL_ROOT = path.join({ segments: [import.meta.dirname, "..", ".."] });

const BEFORE_ROOT = path.join({ segments: [import.meta.dirname, "settings-pair", "before"] });

const AFTER_ROOT = path.join({ segments: [import.meta.dirname, "settings-pair", "after"] });

const WALKER_ROOT = path.join({
  segments: [import.meta.dirname, "..", "infrastructure", "engines", "walker"],
});

const ESLINT_ROOT = path.join({
  segments: [import.meta.dirname, "..", "infrastructure", "engines", "eslint"],
});

const FILE_ANCHOR = { kind: "file" };

const CLOCK_SOURCES = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-17"),
  clause: clauseIdOf("clock-sources"),
};

const CAST_EXPRESSIONS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("cast-expressions"),
};

const NON_NULL_ASSERTIONS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("non-null-assertions"),
};

const COMMENTS_DIRECTIVES = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-5"),
  clause: clauseIdOf("comments-directives"),
};

const IMPORT_BOUNDARIES = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-19"),
  clause: clauseIdOf("import-boundaries"),
};

const TEST_BODY_LOGIC = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LOOPS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const CLOCK_SOURCES_PIECE = {
  anchor: FILE_ANCHOR,
  pieceRoot: path.join({ segments: [WALKER_ROOT, "date-used-directly", "clock-sources"] }),
  settings: { module: "clock-sources.ts" },
  edition: "1",
};

const CAST_EXPRESSIONS_PIECE = {
  anchor: FILE_ANCHOR,
  pieceRoot: path.join({ segments: [WALKER_ROOT, "claimed-type", "unlisted-cast-site"] }),
  settings: {
    module: "cast-expressions.ts",
    escapingDirectives: ["@ts-expect-error", "@ts-ignore", "@ts-nocheck"],
  },
  edition: "1",
};

const NON_NULL_ASSERTIONS_PIECE = {
  anchor: { kind: "keyword", keyword: "!" },
  pieceRoot: path.join({ segments: [ESLINT_ROOT, "claimed-type", "non-null-assertions"] }),
  settings: {
    pluginNamespace: "hone-cd2",
    pluginModule: "eslint-plugin.ts",
    rule: "no-restricted-syntax",
    options: [
      {
        selector: "TSNonNullExpression",
        message:
          "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
      },
      {
        selector: "[definite=true]",
        message:
          "CD-2: a definite assignment assertion claims an assignment the compiler cannot see; initialise the binding instead.",
      },
    ],
  },
  edition: "1",
};

const COMMENTS_DIRECTIVES_PIECE = {
  anchor: FILE_ANCHOR,
  pieceRoot: path.join({ segments: [WALKER_ROOT, "untracked-escape", "directive-pointers"] }),
  settings: { module: "comments-directives.ts" },
  edition: "1",
};

const IMPORT_BOUNDARIES_PIECE = {
  anchor: FILE_ANCHOR,
  pieceRoot: path.join({
    segments: [WALKER_ROOT, "outside-import-past-a-boundary", "import-or-require"],
  }),
  settings: { module: "import-boundaries.ts" },
  edition: "1",
};

const TEST_BODY_LOGIC_PIECE = {
  anchor: FILE_ANCHOR,
  pieceRoot: path.join({ segments: [WALKER_ROOT, "branch-in-a-test", "test-body"] }),
  settings: { module: "test-body-logic.ts" },
  edition: "2",
};

const TRACKER_SETTINGS = { trackerPatterns: ["^\\(spec-\\d+\\)$"] };

const CONFINED_SETTINGS = { confinedOutsideDependencies: ["uuid"] };

const VERSION_ONE_BINDINGS = [
  {
    mechanism: "walker",
    clause: { address: CLOCK_SOURCES, ...CLOCK_SOURCES_PIECE, clauseSettings: {} },
  },
  {
    mechanism: "walker",
    clause: { address: CAST_EXPRESSIONS, ...CAST_EXPRESSIONS_PIECE, clauseSettings: {} },
  },
  {
    mechanism: "eslint",
    clause: { address: NON_NULL_ASSERTIONS, ...NON_NULL_ASSERTIONS_PIECE, clauseSettings: {} },
  },
  {
    mechanism: "walker",
    clause: {
      address: COMMENTS_DIRECTIVES,
      ...COMMENTS_DIRECTIVES_PIECE,
      clauseSettings: TRACKER_SETTINGS,
    },
  },
  {
    mechanism: "walker",
    clause: {
      address: IMPORT_BOUNDARIES,
      ...IMPORT_BOUNDARIES_PIECE,
      clauseSettings: CONFINED_SETTINGS,
    },
  },
  {
    mechanism: "walker",
    clause: { address: TEST_BODY_LOGIC, ...TEST_BODY_LOGIC_PIECE, clauseSettings: {} },
  },
];

const TEST_BODY_FORMS = {
  "branching-with-if": "branch-in-a-test#test-body",
  "a-ternary": "branch-in-a-test#test-body",
  "a-short-circuit": "branch-in-a-test#test-body",
  "an-optional-chain-after-an-index": "branch-in-a-test#test-body",
  "an-optional-chain-on-a-mock-call": "branch-in-a-test#test-body",
  "an-optional-chain-on-a-mock-result": "branch-in-a-test#test-body",
  "an-optional-chain-on-a-property": "branch-in-a-test#test-body",
  "an-optional-call": "branch-in-a-test#test-body",
  "a-switch": "branch-in-a-test#test-body",
  "a-method-that-picks-or-tests-an-element": "computed-value-in-a-test#test-body",
  "a-method-that-computes-a-value": "computed-value-in-a-test#test-body",
  "a-method-that-mutates": "computed-value-in-a-test#test-body",
  "merging-objects": "computed-value-in-a-test#test-body",
  "building-an-object-from-entries": "computed-value-in-a-test#test-body",
  "building-an-array-from-a-length": "computed-value-in-a-test#test-body",
  "a-math-call": "computed-value-in-a-test#test-body",
  "a-let": "rebinding#test-body",
  "serialising-or-parsing-json": "text-past-its-reader#test-body",
  "a-try-block": "throw-or-catch-in-a-test#try-block",
  "logic-inside-a-function-the-test-passes-on": "double-with-a-body#logic-in-a-passed-function",
};

const SINGLE_EDITION = { declared: ["1"], default: "1", latest: "1" };

const TEST_BODY_EDITIONS = { declared: ["1", "2"], default: "1", latest: "2" };

const VERSION_TWO_SELECTED = [
  {
    position: 0,
    clause: CLOCK_SOURCES,
    binding: {
      address: "date-used-directly#clock-sources",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...CLOCK_SOURCES_PIECE,
      forms: {},
      checkSettings: {},
    },
    editions: SINGLE_EDITION,
  },
  {
    position: 1,
    clause: CAST_EXPRESSIONS,
    binding: {
      address: "claimed-type#unlisted-cast-site",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...CAST_EXPRESSIONS_PIECE,
      forms: {},
      checkSettings: {},
    },
    editions: SINGLE_EDITION,
  },
  {
    position: 2,
    clause: NON_NULL_ASSERTIONS,
    binding: {
      address: "claimed-type#non-null-assertions",
      ruleSet: TOOL_RULE_SET,
      engine: "eslint",
      ...NON_NULL_ASSERTIONS_PIECE,
      forms: {},
      checkSettings: {},
    },
    editions: SINGLE_EDITION,
  },
  {
    position: 3,
    clause: COMMENTS_DIRECTIVES,
    binding: {
      address: "untracked-escape#directive-pointers",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...COMMENTS_DIRECTIVES_PIECE,
      forms: {},
      checkSettings: TRACKER_SETTINGS,
    },
    editions: SINGLE_EDITION,
  },
  {
    position: 4,
    clause: IMPORT_BOUNDARIES,
    binding: {
      address: "outside-import-past-a-boundary#import-or-require",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...IMPORT_BOUNDARIES_PIECE,
      forms: {},
      checkSettings: CONFINED_SETTINGS,
    },
    editions: SINGLE_EDITION,
  },
  {
    position: 5,
    clause: TEST_BODY_LOGIC,
    binding: {
      address: "branch-in-a-test#test-body",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...TEST_BODY_LOGIC_PIECE,
      forms: TEST_BODY_FORMS,
      checkSettings: {},
    },
    editions: TEST_BODY_EDITIONS,
  },
  {
    position: 6,
    clause: TEST_BODY_LOGIC,
    binding: {
      address: "computed-value-in-a-test#test-body",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...TEST_BODY_LOGIC_PIECE,
      forms: TEST_BODY_FORMS,
      checkSettings: {},
    },
    editions: TEST_BODY_EDITIONS,
  },
  {
    position: 7,
    clause: TEST_BODY_LOGIC,
    binding: {
      address: "rebinding#test-body",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...TEST_BODY_LOGIC_PIECE,
      forms: TEST_BODY_FORMS,
      checkSettings: {},
    },
    editions: TEST_BODY_EDITIONS,
  },
  {
    position: 8,
    clause: TEST_BODY_LOGIC,
    binding: {
      address: "text-past-its-reader#test-body",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...TEST_BODY_LOGIC_PIECE,
      forms: TEST_BODY_FORMS,
      checkSettings: {},
    },
    editions: TEST_BODY_EDITIONS,
  },
  {
    position: 9,
    clause: TEST_BODY_LOGIC,
    binding: {
      address: "throw-or-catch-in-a-test#try-block",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...TEST_BODY_LOGIC_PIECE,
      forms: TEST_BODY_FORMS,
      checkSettings: {},
    },
    editions: TEST_BODY_EDITIONS,
  },
  {
    position: 10,
    clause: TEST_BODY_LOGIC,
    binding: {
      address: "double-with-a-body#logic-in-a-passed-function",
      ruleSet: TOOL_RULE_SET,
      engine: "walker",
      ...TEST_BODY_LOGIC_PIECE,
      forms: TEST_BODY_FORMS,
      checkSettings: {},
    },
    editions: TEST_BODY_EDITIONS,
  },
];

const VERSION_ONE_CLAUSE_ROOTS = [
  {
    clause: CLOCK_SOURCES,
    ruleSetRoot: INSTALL_ROOT,
    checks: [{ name: "clock-sources", symptom: { name: "date-used-directly" } }],
  },
  {
    clause: CAST_EXPRESSIONS,
    ruleSetRoot: INSTALL_ROOT,
    checks: [{ name: "unlisted-cast-site", symptom: { name: "claimed-type" } }],
  },
  {
    clause: NON_NULL_ASSERTIONS,
    ruleSetRoot: INSTALL_ROOT,
    checks: [{ name: "non-null-assertions", symptom: { name: "claimed-type" } }],
  },
  {
    clause: COMMENTS_DIRECTIVES,
    ruleSetRoot: INSTALL_ROOT,
    checks: [{ name: "directive-pointers", symptom: { name: "untracked-escape" } }],
  },
  {
    clause: IMPORT_BOUNDARIES,
    ruleSetRoot: INSTALL_ROOT,
    checks: [{ name: "import-or-require", symptom: { name: "outside-import-past-a-boundary" } }],
  },
  {
    clause: TEST_BODY_LOGIC,
    ruleSetRoot: INSTALL_ROOT,
    checks: [
      { name: "test-body", symptom: { name: "branch-in-a-test" } },
      { name: "test-body", symptom: { name: "computed-value-in-a-test" } },
      { name: "logic-in-a-passed-function", symptom: { name: "double-with-a-body" } },
      { name: "test-body", symptom: { name: "rebinding" } },
      { name: "test-body", symptom: { name: "text-past-its-reader" } },
      { name: "try-block", symptom: { name: "throw-or-catch-in-a-test" } },
    ],
  },
];

const VERSION_ONE_SELECTION = {
  selected: [
    { address: CLOCK_SOURCES, mechanism: "walker", exceptions: "allowed" },
    { address: CAST_EXPRESSIONS, mechanism: "walker", exceptions: "allowed" },
    { address: NON_NULL_ASSERTIONS, mechanism: "eslint", exceptions: "allowed" },
    { address: COMMENTS_DIRECTIVES, mechanism: "walker", exceptions: "allowed" },
    { address: IMPORT_BOUNDARIES, mechanism: "walker", exceptions: "allowed" },
    { address: TEST_BODY_LOGIC, mechanism: "walker", exceptions: "allowed" },
  ],
  uncovered: [
    {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-27"),
      clause: clauseIdOf("focused-tests"),
    },
    {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-27"),
      clause: clauseIdOf("skipped-tests"),
    },
  ],
  notAdopted: [LOOPS],
  notRun: [],
  editions: [{ address: TEST_BODY_LOGIC, mechanism: "walker", edition: "2", latest: "2" }],
};

const RUN_SETTINGS = { reportOutput: "full", assessment: { forfeiture: "elsewhere" } };

const AVAILABLE_CHECKS = [
  {
    position: 0,
    name: "cast-to-any",
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-1"),
      clause: clauseIdOf("any-cast"),
    },
    engines: [{ name: "walker" }],
  },
  {
    position: 1,
    name: "stub-implementation",
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-25"),
      clause: clauseIdOf("dependency-isolation"),
    },
    engines: [{ name: "walker" }],
  },
  {
    position: 2,
    name: "parameter-reassignment",
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-44"),
      clause: clauseIdOf("parameter-reassignment"),
    },
    engines: [{ name: "eslint" }, { name: "oxlint" }],
  },
  {
    position: 3,
    name: "throw-statement",
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-10"),
      clause: clauseIdOf("throws-in-tests"),
    },
    engines: [{ name: "walker" }],
  },
];

describe("the plan's version 1 and version 2 files through the settings pipeline", () => {
  it("version 1 gives each clause's binding with its clause settings, edition, anchor and piece root", () => {
    const installRoot = path.resolve({ path: INSTALL_ROOT });
    assert(installRoot.outcome === "ok", "the install root resolves");
    const beforeRoot = path.resolve({ path: BEFORE_ROOT });
    assert(beforeRoot.outcome === "ok", "the version 1 root resolves");
    const reading = createSelectionRepository({
      repoRoot: beforeRoot.value,
      installRoot: installRoot.value,
      moduleExtension: ".ts",
      fileText,
      path,
    }).read({});
    assert(reading.outcome === "ok", "the plan's version 1 file loads");
    expect(reading.value.bindings).toEqual(VERSION_ONE_BINDINGS);
  });

  it("version 1 gives its selected clauses, clause roots, not-adopted clauses, not-run clauses, editions and excluded paths", () => {
    const installRoot = path.resolve({ path: INSTALL_ROOT });
    assert(installRoot.outcome === "ok", "the install root resolves");
    const beforeRoot = path.resolve({ path: BEFORE_ROOT });
    assert(beforeRoot.outcome === "ok", "the version 1 root resolves");
    const reading = createSelectionRepository({
      repoRoot: beforeRoot.value,
      installRoot: installRoot.value,
      moduleExtension: ".ts",
      fileText,
      path,
    }).read({});
    assert(reading.outcome === "ok", "the plan's version 1 file loads");
    expect(reading.value.selection).toEqual(VERSION_ONE_SELECTION);
    expect(reading.value.clauseRoots).toEqual(VERSION_ONE_CLAUSE_ROOTS);
    expect(reading.value.excluded).toEqual(["vendor"]);
  });

  it.each(VERSION_TWO_SELECTED)(
    "version 2 selects as check $position the same clause, with the binding and editions version 1 gives it",
    ({ position, clause, binding, editions }) => {
      const installRoot = path.resolve({ path: INSTALL_ROOT });
      assert(installRoot.outcome === "ok", "the install root resolves");
      const afterRoot = path.resolve({ path: AFTER_ROOT });
      assert(afterRoot.outcome === "ok", "the version 2 root resolves");
      const catalogue = readBoundCatalogue({
        ruleSet: TOOL_RULE_SET,
        inheritedRecordKinds: [],
        directory: createDefaultDirectoryPort({}),
        fileText,
        path,
        ruleSetRoot: installRoot.value,
        installRoot: installRoot.value,
      });
      assert(catalogue.outcome === "ok", "this repository's catalogue reads");
      assert(catalogue.value.held === "catalogue", "this repository holds a catalogue");
      const stages = versionTwoStagesOver({
        ports: {
          fileText,
          path,
          modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
          namedEngine: RUNNER_ENGINES.namedEngine,
          git: {
            trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
            changedSince: vi.fn<GitPort["changedSince"]>(),
            contentInBase: vi.fn<GitPort["contentInBase"]>(),
            textInBase: vi.fn<GitPort["textInBase"]>(),
            renamedSince: vi.fn<GitPort["renamedSince"]>(),
          },
          gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
          directory: createDefaultDirectoryPort({}),
          recordsSourceOf: vi.fn<RecordsSourceOf>(),
          settingsSourcesOf: createSettingsSources,
        },
        locations: {
          repoRoot: afterRoot.value,
          installRoot: installRoot.value,
          moduleExtension: ".ts",
          baseRevision: undefined,
        },
      });
      const settings = stages.settings({ catalogue: catalogue.value.catalogue });
      assert(settings.outcome === "ok", "the plan's version 2 file loads");
      const selected = settings.value.selection.selected[position];
      assert.isDefined(selected);
      expect(selected.check.clause).toEqual(clause);
      expect(selected.binding).toEqual(binding);
      expect(selected.exceptions).toBe("allowed");
      expect(selected.editions).toEqual(editions);
    },
  );

  it("version 2 selects as many checks, runs them all, excludes the same paths and leaves the selection without an uncovered field", () => {
    const installRoot = path.resolve({ path: INSTALL_ROOT });
    assert(installRoot.outcome === "ok", "the install root resolves");
    const afterRoot = path.resolve({ path: AFTER_ROOT });
    assert(afterRoot.outcome === "ok", "the version 2 root resolves");
    const catalogue = readBoundCatalogue({
      ruleSet: TOOL_RULE_SET,
      inheritedRecordKinds: [],
      directory: createDefaultDirectoryPort({}),
      fileText,
      path,
      ruleSetRoot: installRoot.value,
      installRoot: installRoot.value,
    });
    assert(catalogue.outcome === "ok", "this repository's catalogue reads");
    assert(catalogue.value.held === "catalogue", "this repository holds a catalogue");
    const stages = versionTwoStagesOver({
      ports: {
        fileText,
        path,
        modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
        namedEngine: RUNNER_ENGINES.namedEngine,
        git: {
          trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
          changedSince: vi.fn<GitPort["changedSince"]>(),
          contentInBase: vi.fn<GitPort["contentInBase"]>(),
          textInBase: vi.fn<GitPort["textInBase"]>(),
          renamedSince: vi.fn<GitPort["renamedSince"]>(),
        },
        gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
        directory: createDefaultDirectoryPort({}),
        recordsSourceOf: vi.fn<RecordsSourceOf>(),
        settingsSourcesOf: createSettingsSources,
      },
      locations: {
        repoRoot: afterRoot.value,
        installRoot: installRoot.value,
        moduleExtension: ".ts",
        baseRevision: undefined,
      },
    });
    const settings = stages.settings({ catalogue: catalogue.value.catalogue });
    assert(settings.outcome === "ok", "the plan's version 2 file loads");
    expect(settings.value.selection.selected).toHaveLength(11);
    expect(settings.value.selection.notRun).toEqual([]);
    expect(settings.value.selection.excluded).toEqual(["vendor"]);
    expect(settings.value.selection.eslintConfigRoots).toEqual([]);
    expect("uncovered" in settings.value.selection).toBe(false);
    expect(settings.value.available).toHaveLength(4);
  });

  it("version 2 leaves the same clause not adopted", () => {
    const installRoot = path.resolve({ path: INSTALL_ROOT });
    assert(installRoot.outcome === "ok", "the install root resolves");
    const afterRoot = path.resolve({ path: AFTER_ROOT });
    assert(afterRoot.outcome === "ok", "the version 2 root resolves");
    const catalogue = readBoundCatalogue({
      ruleSet: TOOL_RULE_SET,
      inheritedRecordKinds: [],
      directory: createDefaultDirectoryPort({}),
      fileText,
      path,
      ruleSetRoot: installRoot.value,
      installRoot: installRoot.value,
    });
    assert(catalogue.outcome === "ok", "this repository's catalogue reads");
    assert(catalogue.value.held === "catalogue", "this repository holds a catalogue");
    const stages = versionTwoStagesOver({
      ports: {
        fileText,
        path,
        modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
        namedEngine: RUNNER_ENGINES.namedEngine,
        git: {
          trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
          changedSince: vi.fn<GitPort["changedSince"]>(),
          contentInBase: vi.fn<GitPort["contentInBase"]>(),
          textInBase: vi.fn<GitPort["textInBase"]>(),
          renamedSince: vi.fn<GitPort["renamedSince"]>(),
        },
        gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
        directory: createDefaultDirectoryPort({}),
        recordsSourceOf: vi.fn<RecordsSourceOf>(),
        settingsSourcesOf: createSettingsSources,
      },
      locations: {
        repoRoot: afterRoot.value,
        installRoot: installRoot.value,
        moduleExtension: ".ts",
        baseRevision: undefined,
      },
    });
    const settings = stages.settings({ catalogue: catalogue.value.catalogue });
    assert(settings.outcome === "ok", "the plan's version 2 file loads");
    expect(settings.value.selection.notAdopted).toHaveLength(1);
    const [loops] = settings.value.selection.notAdopted;
    assert.isDefined(loops);
    expect(loops.address).toEqual({ ruleSet: TOOL_RULE_SET, check: "loop-keyword#loop-statement" });
    expect(loops.check.clause).toEqual(LOOPS);
    expect(loops.choice).toEqual({ state: "not-adopted" });
  });

  it("version 1 gives its run settings", () => {
    const beforeRoot = path.resolve({ path: BEFORE_ROOT });
    assert(beforeRoot.outcome === "ok", "the version 1 root resolves");
    expect(readRunSettings({ fileText, path, repoRoot: beforeRoot.value })).toEqual({
      outcome: "ok",
      value: RUN_SETTINGS,
    });
  });

  it("version 2 gives the same run settings", () => {
    const installRoot = path.resolve({ path: INSTALL_ROOT });
    assert(installRoot.outcome === "ok", "the install root resolves");
    const afterRoot = path.resolve({ path: AFTER_ROOT });
    assert(afterRoot.outcome === "ok", "the version 2 root resolves");
    const catalogue = readBoundCatalogue({
      ruleSet: TOOL_RULE_SET,
      inheritedRecordKinds: [],
      directory: createDefaultDirectoryPort({}),
      fileText,
      path,
      ruleSetRoot: installRoot.value,
      installRoot: installRoot.value,
    });
    assert(catalogue.outcome === "ok", "this repository's catalogue reads");
    assert(catalogue.value.held === "catalogue", "this repository holds a catalogue");
    const stages = versionTwoStagesOver({
      ports: {
        fileText,
        path,
        modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
        namedEngine: RUNNER_ENGINES.namedEngine,
        git: {
          trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
          changedSince: vi.fn<GitPort["changedSince"]>(),
          contentInBase: vi.fn<GitPort["contentInBase"]>(),
          textInBase: vi.fn<GitPort["textInBase"]>(),
          renamedSince: vi.fn<GitPort["renamedSince"]>(),
        },
        gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
        directory: createDefaultDirectoryPort({}),
        recordsSourceOf: vi.fn<RecordsSourceOf>(),
        settingsSourcesOf: createSettingsSources,
      },
      locations: {
        repoRoot: afterRoot.value,
        installRoot: installRoot.value,
        moduleExtension: ".ts",
        baseRevision: undefined,
      },
    });
    const settings = stages.settings({ catalogue: catalogue.value.catalogue });
    assert(settings.outcome === "ok", "the plan's version 2 file loads");
    expect(settings.value.runSettings).toEqual(RUN_SETTINGS);
  });

  it.each(AVAILABLE_CHECKS)(
    "offers as available check $name of a listed symptom that is listed nowhere",
    ({ position, name, clause, engines }) => {
      const installRoot = path.resolve({ path: INSTALL_ROOT });
      assert(installRoot.outcome === "ok", "the install root resolves");
      const afterRoot = path.resolve({ path: AFTER_ROOT });
      assert(afterRoot.outcome === "ok", "the version 2 root resolves");
      const catalogue = readBoundCatalogue({
        ruleSet: TOOL_RULE_SET,
        inheritedRecordKinds: [],
        directory: createDefaultDirectoryPort({}),
        fileText,
        path,
        ruleSetRoot: installRoot.value,
        installRoot: installRoot.value,
      });
      assert(catalogue.outcome === "ok", "this repository's catalogue reads");
      assert(catalogue.value.held === "catalogue", "this repository holds a catalogue");
      const stages = versionTwoStagesOver({
        ports: {
          fileText,
          path,
          modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
          namedEngine: RUNNER_ENGINES.namedEngine,
          git: {
            trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
            changedSince: vi.fn<GitPort["changedSince"]>(),
            contentInBase: vi.fn<GitPort["contentInBase"]>(),
            textInBase: vi.fn<GitPort["textInBase"]>(),
            renamedSince: vi.fn<GitPort["renamedSince"]>(),
          },
          gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
          directory: createDefaultDirectoryPort({}),
          recordsSourceOf: vi.fn<RecordsSourceOf>(),
          settingsSourcesOf: createSettingsSources,
        },
        locations: {
          repoRoot: afterRoot.value,
          installRoot: installRoot.value,
          moduleExtension: ".ts",
          baseRevision: undefined,
        },
      });
      const settings = stages.settings({ catalogue: catalogue.value.catalogue });
      assert(settings.outcome === "ok", "the plan's version 2 file loads");
      const available = settings.value.available[position];
      assert.isDefined(available);
      expect(available.name).toBe(name);
      expect(available.clause).toEqual(clause);
      expect(available.engines).toEqual(engines);
    },
  );

  it("requires every record's why-chain in version 2, where version 1 left it optional", () => {
    const installRoot = path.resolve({ path: INSTALL_ROOT });
    assert(installRoot.outcome === "ok", "the install root resolves");
    const beforeRoot = path.resolve({ path: BEFORE_ROOT });
    assert(beforeRoot.outcome === "ok", "the version 1 root resolves");
    const reading = createSelectionRepository({
      repoRoot: beforeRoot.value,
      installRoot: installRoot.value,
      moduleExtension: ".ts",
      fileText,
      path,
    }).read({});
    assert(reading.outcome === "ok", "the plan's version 1 file loads");
    expect(reading.value.fileExceptionWhyChains).toBe("optional");
    const whyChainless = statedAuthorisedLocationWireSchema.safeParse({
      answers: "claimed-type#unlisted-cast-site",
      file: "src/authorised.ts",
      case: "gives-a-value-its-type",
      owes: "declared-not-asserted",
    });
    assert(whyChainless.success === false, "a record without a why-chain is refused");
    expect(whyChainless.error.issues).toEqual([
      {
        expected: "object",
        code: "invalid_type",
        path: ["whyChain"],
        message: "`whyChain` is not a JSON object",
      },
    ]);
  });
});

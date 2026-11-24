import { afterAll, assert, describe, expect, it, vi } from "vitest";

import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import type { ExceptionRecord } from "../domain/records/discipline-exceptions/exception-record.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import type { AnsweredFile } from "../domain/runner/checks-run-report.ts";
import { absolutePathSchema } from "../infrastructure/content-files/absolute-path.ts";
import { createSelectionRepository } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { versionOneProjectionOver } from "../infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import { checksProjectionText } from "../infrastructure/engines/eslint/runner/projection/checks-projection.ts";
import { projectedNamedChecksOf } from "../infrastructure/engines/eslint/runner/projection/projected-checks.ts";
import { eslint9ToolchainModules } from "../infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import { resolvedConfigSchema } from "../infrastructure/engines/eslint/runner/toolchain/eslint-config-schema.ts";
import { defaultEslintToolchainPeers } from "../infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { runnerModuleAt } from "../infrastructure/engines/protocol/runner-module/runner-module-at.ts";
import { createSettingsSources } from "../infrastructure/hone-config-file/settings-sources.ts";
import { createDefaultDirectoryTreePort } from "../infrastructure/node/file-system/directory-tree-port.ts";
import { createDefaultFileRemovalPort } from "../infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { runnerEnginesOver } from "./runner-engines.ts";
import { type VersionTwoLocations, versionTwoStagesOver } from "./version-two-stages.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const directory = createDefaultDirectoryPort({});

const directoryTree = createDefaultDirectoryTreePort({});

const VERSION_ONE_PROJECTION = versionOneProjectionOver({
  fileText,
  fileRemoval: createDefaultFileRemovalPort({}),
  path,
  moduleExtension: ".ts",
});

const INSTALL_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", ".."] }),
);

const PAIR_ROOT = path.join({
  segments: [
    import.meta.dirname,
    "..",
    "infrastructure",
    "engines",
    "eslint",
    "runner",
    "projection",
    "projection-pair",
  ],
});

const BEFORE_ROOT = absolutePathSchema.parse(path.join({ segments: [PAIR_ROOT, "before"] }));

const AFTER_ROOT = absolutePathSchema.parse(path.join({ segments: [PAIR_ROOT, "after"] }));

const VERSION_TWO_LOCATIONS: VersionTwoLocations = {
  repoRoot: AFTER_ROOT,
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  baseRevision: undefined,
};

const VERSION_TWO_HOST = {
  fileText,
  path,
  directory,
  namedEngine: runnerEnginesOver({ runnerModuleOf: runnerModuleAt }).namedEngine,
  settingsSourcesOf: createSettingsSources,
};

const PLUGIN_IMPORT = import.meta.resolve("../eslint-plugin.ts");

const ESLINT_LINES = [
  {
    line: "eslint-10",
    modules: defaultEslintToolchainPeers({ installRoot: INSTALL_ROOT, installForm: "source" })
      .modules,
    versionOne: absolutePathSchema.parse(
      path.join({ segments: [INSTALL_ROOT, "artefacts", "projection-pair-eslint-10-version-one"] }),
    ),
    versionTwo: absolutePathSchema.parse(
      path.join({ segments: [INSTALL_ROOT, "artefacts", "projection-pair-eslint-10-version-two"] }),
    ),
  },
  {
    line: "eslint-9",
    modules: eslint9ToolchainModules,
    versionOne: absolutePathSchema.parse(
      path.join({ segments: [INSTALL_ROOT, "artefacts", "projection-pair-eslint-9-version-one"] }),
    ),
    versionTwo: absolutePathSchema.parse(
      path.join({ segments: [INSTALL_ROOT, "artefacts", "projection-pair-eslint-9-version-two"] }),
    ),
  },
];

const ESLINT = "eslint" as const;

const LEGACY = repoPathOf("src/legacy.ts");

const WIDE = repoPathOf("src/wide.ts");

const SKIPPING = repoPathOf("src/skipping.test.ts");

const VERSION_ONE_RECORDS: readonly ExceptionRecord[] = [
  {
    kind: "file-carve-out",
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-2"),
      clause: clauseIdOf("non-null-assertions"),
    },
    mechanism: ESLINT,
    file: LEGACY,
  },
  {
    kind: "authorised-location",
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-44"),
      clause: clauseIdOf("parameter-reassignment"),
    },
    mechanism: ESLINT,
    file: LEGACY,
    reason: "a reducer rebinds its accumulator",
  },
  {
    kind: "file-carve-out",
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-40"),
      clause: clauseIdOf("parameter-count"),
    },
    mechanism: ESLINT,
    file: WIDE,
  },
  {
    kind: "file-carve-out",
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-27"),
      clause: clauseIdOf("skipped-tests"),
    },
    mechanism: ESLINT,
    file: SKIPPING,
  },
];

const VERSION_TWO_ANSWERED: readonly AnsweredFile[] = [
  { ruleSet: TOOL_RULE_SET, symptom: "claimed-type", file: LEGACY },
  { ruleSet: TOOL_RULE_SET, symptom: "rebinding", file: LEGACY },
  { ruleSet: TOOL_RULE_SET, symptom: "positional-parameters", file: WIDE },
  { ruleSet: TOOL_RULE_SET, symptom: "test-switched-off", check: "skipped-tests", file: SKIPPING },
];

const NON_NULL_ASSERTIONS_ON = [
  2,
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
];

const NON_NULL_ASSERTIONS_OFF = [
  0,
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
];

const NAMING_CONVENTION = [
  2,
  {
    selector: [
      "objectLiteralProperty",
      "objectLiteralMethod",
      "typeProperty",
      "typeMethod",
      "classProperty",
      "classMethod",
      "accessor",
      "enumMember",
    ],
    modifiers: ["requiresQuotes"],
    format: null,
  },
  {
    selector: ["variable", "function", "parameter"],
    modifiers: ["unused"],
    format: null,
    filter: { regex: "^_", match: true },
  },
  { selector: ["variable", "parameter"], modifiers: ["destructured"], format: null },
  { selector: "import", format: null },
  {
    selector: ["classProperty", "classMethod", "accessor", "parameterProperty"],
    modifiers: ["override"],
    format: null,
  },
  {
    selector: "variable",
    modifiers: ["const"],
    format: null,
    custom: {
      regex:
        "^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$",
      match: true,
    },
  },
  {
    selector: "variable",
    format: null,
    custom: {
      regex: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      match: true,
    },
  },
  {
    selector: "function",
    format: null,
    custom: {
      regex: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      match: true,
    },
  },
  {
    selector: "function",
    modifiers: ["global"],
    format: null,
    custom: {
      regex:
        "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*)?[_$]*$",
      match: true,
    },
  },
  {
    selector: "parameter",
    format: null,
    custom: {
      regex: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      match: true,
    },
  },
  {
    selector: "typeLike",
    format: null,
    custom: {
      regex: "^[_$]*(?:[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      match: true,
    },
  },
  {
    selector: "enumMember",
    format: null,
    custom: { regex: "^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$", match: true },
  },
  {
    selector: ["classProperty", "classMethod", "accessor", "parameterProperty"],
    format: null,
    custom: { regex: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$", match: true },
  },
  {
    selector: ["classProperty", "accessor"],
    modifiers: ["static"],
    format: null,
    custom: {
      regex: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$",
      match: true,
    },
  },
  {
    selector: "objectLiteralProperty",
    format: null,
    custom: { regex: "^(?:[a-z0-9][A-Za-z0-9]*)$", match: true },
  },
  {
    selector: "objectLiteralMethod",
    format: null,
    custom: { regex: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$", match: true },
  },
  {
    selector: "typeProperty",
    format: null,
    custom: {
      regex: "^(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$",
      match: true,
    },
  },
  {
    selector: "typeMethod",
    format: null,
    custom: { regex: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$", match: true },
  },
  {
    selector: "import",
    modifiers: ["default"],
    format: null,
    custom: {
      regex:
        "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$",
      match: true,
    },
  },
  {
    selector: "import",
    modifiers: ["namespace"],
    format: null,
    custom: {
      regex: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      match: true,
    },
  },
];

const CLASS_KEYWORD = [2];

const STATIC_MEMBERS_ONLY = [
  2,
  {
    allowConstructorOnly: true,
    allowEmpty: true,
    allowStaticOnly: false,
    allowWithDecorator: true,
  },
];

const FOCUSED_TESTS = [2];

const SKIPPED_TESTS_ON = [2];

const SKIPPED_TESTS_OFF = [0];

const PARAMETER_COUNT_ON = [2, { max: 2, countVoidThis: true }];

const PARAMETER_COUNT_OFF = [0, { max: 2, countVoidThis: true }];

const PARAMETER_REASSIGNMENT_ON = [2, { props: false }];

const PARAMETER_REASSIGNMENT_OFF = [0, { props: false }];

const UNANSWERED_VERSION_ONE_RULES = {
  "hone-cd2/no-restricted-syntax": NON_NULL_ASSERTIONS_ON,
  "hone-cd6/naming-convention": NAMING_CONVENTION,
  "hone/no-class-authoring": CLASS_KEYWORD,
  "hone/no-extraneous-class": STATIC_MEMBERS_ONLY,
  "hone-cd27/focused-tests": FOCUSED_TESTS,
  "hone-cd27/skipped-tests": SKIPPED_TESTS_ON,
  "hone-cd40/max-params": PARAMETER_COUNT_ON,
  "hone-cd44/no-param-reassign": PARAMETER_REASSIGNMENT_ON,
};

const UNANSWERED_VERSION_TWO_RULES = {
  "hone/claimed-type#non-null-assertions": NON_NULL_ASSERTIONS_ON,
  "hone/name-off-its-casing#naming-convention": NAMING_CONVENTION,
  "hone/authored-class-or-this#class-keyword": CLASS_KEYWORD,
  "hone/authored-class-or-this#static-members-only": STATIC_MEMBERS_ONLY,
  "hone/test-switched-off#focused-tests": FOCUSED_TESTS,
  "hone/test-switched-off#skipped-tests": SKIPPED_TESTS_ON,
  "hone/positional-parameters#parameter-count": PARAMETER_COUNT_ON,
  "hone/rebinding#parameter-reassignment": PARAMETER_REASSIGNMENT_ON,
};

const LEGACY_VERSION_ONE_RULES = {
  "hone-cd2/no-restricted-syntax": NON_NULL_ASSERTIONS_OFF,
  "hone-cd6/naming-convention": NAMING_CONVENTION,
  "hone/no-class-authoring": CLASS_KEYWORD,
  "hone/no-extraneous-class": STATIC_MEMBERS_ONLY,
  "hone-cd27/focused-tests": FOCUSED_TESTS,
  "hone-cd27/skipped-tests": SKIPPED_TESTS_ON,
  "hone-cd40/max-params": PARAMETER_COUNT_ON,
  "hone-cd44/no-param-reassign": PARAMETER_REASSIGNMENT_OFF,
};

const LEGACY_VERSION_TWO_RULES = {
  "hone/claimed-type#non-null-assertions": NON_NULL_ASSERTIONS_OFF,
  "hone/name-off-its-casing#naming-convention": NAMING_CONVENTION,
  "hone/authored-class-or-this#class-keyword": CLASS_KEYWORD,
  "hone/authored-class-or-this#static-members-only": STATIC_MEMBERS_ONLY,
  "hone/test-switched-off#focused-tests": FOCUSED_TESTS,
  "hone/test-switched-off#skipped-tests": SKIPPED_TESTS_ON,
  "hone/positional-parameters#parameter-count": PARAMETER_COUNT_ON,
  "hone/rebinding#parameter-reassignment": PARAMETER_REASSIGNMENT_OFF,
};

const WIDE_VERSION_ONE_RULES = {
  "hone-cd2/no-restricted-syntax": NON_NULL_ASSERTIONS_ON,
  "hone-cd6/naming-convention": NAMING_CONVENTION,
  "hone/no-class-authoring": CLASS_KEYWORD,
  "hone/no-extraneous-class": STATIC_MEMBERS_ONLY,
  "hone-cd27/focused-tests": FOCUSED_TESTS,
  "hone-cd27/skipped-tests": SKIPPED_TESTS_ON,
  "hone-cd40/max-params": PARAMETER_COUNT_OFF,
  "hone-cd44/no-param-reassign": PARAMETER_REASSIGNMENT_ON,
};

const WIDE_VERSION_TWO_RULES = {
  "hone/claimed-type#non-null-assertions": NON_NULL_ASSERTIONS_ON,
  "hone/name-off-its-casing#naming-convention": NAMING_CONVENTION,
  "hone/authored-class-or-this#class-keyword": CLASS_KEYWORD,
  "hone/authored-class-or-this#static-members-only": STATIC_MEMBERS_ONLY,
  "hone/test-switched-off#focused-tests": FOCUSED_TESTS,
  "hone/test-switched-off#skipped-tests": SKIPPED_TESTS_ON,
  "hone/positional-parameters#parameter-count": PARAMETER_COUNT_OFF,
  "hone/rebinding#parameter-reassignment": PARAMETER_REASSIGNMENT_ON,
};

const SKIPPING_VERSION_ONE_RULES = {
  "hone-cd2/no-restricted-syntax": NON_NULL_ASSERTIONS_ON,
  "hone-cd6/naming-convention": NAMING_CONVENTION,
  "hone/no-class-authoring": CLASS_KEYWORD,
  "hone/no-extraneous-class": STATIC_MEMBERS_ONLY,
  "hone-cd27/focused-tests": FOCUSED_TESTS,
  "hone-cd27/skipped-tests": SKIPPED_TESTS_OFF,
  "hone-cd40/max-params": PARAMETER_COUNT_ON,
  "hone-cd44/no-param-reassign": PARAMETER_REASSIGNMENT_ON,
};

const SKIPPING_VERSION_TWO_RULES = {
  "hone/claimed-type#non-null-assertions": NON_NULL_ASSERTIONS_ON,
  "hone/name-off-its-casing#naming-convention": NAMING_CONVENTION,
  "hone/authored-class-or-this#class-keyword": CLASS_KEYWORD,
  "hone/authored-class-or-this#static-members-only": STATIC_MEMBERS_ONLY,
  "hone/test-switched-off#focused-tests": FOCUSED_TESTS,
  "hone/test-switched-off#skipped-tests": SKIPPED_TESTS_OFF,
  "hone/positional-parameters#parameter-count": PARAMETER_COUNT_ON,
  "hone/rebinding#parameter-reassignment": PARAMETER_REASSIGNMENT_ON,
};

const DONE = { outcome: "ok", value: undefined };

const PROBED_FILES = [
  {
    file: "src/kept.ts",
    scratch: "kept",
    versionOneRules: UNANSWERED_VERSION_ONE_RULES,
    versionTwoRules: UNANSWERED_VERSION_TWO_RULES,
  },
  {
    file: "src/legacy.ts",
    scratch: "legacy",
    versionOneRules: LEGACY_VERSION_ONE_RULES,
    versionTwoRules: LEGACY_VERSION_TWO_RULES,
  },
  {
    file: "src/wide.ts",
    scratch: "wide",
    versionOneRules: WIDE_VERSION_ONE_RULES,
    versionTwoRules: WIDE_VERSION_TWO_RULES,
  },
  {
    file: "src/view.tsx",
    scratch: "view",
    versionOneRules: UNANSWERED_VERSION_ONE_RULES,
    versionTwoRules: UNANSWERED_VERSION_TWO_RULES,
  },
  {
    file: "tools/build.mts",
    scratch: "build",
    versionOneRules: UNANSWERED_VERSION_ONE_RULES,
    versionTwoRules: UNANSWERED_VERSION_TWO_RULES,
  },
  {
    file: "index.cts",
    scratch: "index",
    versionOneRules: UNANSWERED_VERSION_ONE_RULES,
    versionTwoRules: UNANSWERED_VERSION_TWO_RULES,
  },
  {
    file: "packages/web/src/deep/kept.ts",
    scratch: "deep-kept",
    versionOneRules: UNANSWERED_VERSION_ONE_RULES,
    versionTwoRules: UNANSWERED_VERSION_TWO_RULES,
  },
  {
    file: "src/skipping.test.ts",
    scratch: "skipping",
    versionOneRules: SKIPPING_VERSION_ONE_RULES,
    versionTwoRules: SKIPPING_VERSION_TWO_RULES,
  },
];

afterAll(() => {
  directoryTree.remove({ path: ESLINT_LINES[0].versionOne });
  directoryTree.remove({ path: ESLINT_LINES[0].versionTwo });
  directoryTree.remove({ path: ESLINT_LINES[1].versionOne });
  directoryTree.remove({ path: ESLINT_LINES[1].versionTwo });
});

describe.each(ESLINT_LINES)(
  "on $line, the pair's projections",
  ({ modules, versionOne, versionTwo }) => {
    it.each(PROBED_FILES)(
      "version 1 enables the pair's rules and options on $file",
      async (expected) => {
        const scratch = absolutePathSchema.parse(`${versionOne}/${expected.scratch}`);
        expect([
          directoryTree.remove({ path: scratch }),
          directory.create({ path: scratch }),
        ]).toEqual([DONE, DONE]);
        const selection = createSelectionRepository({
          repoRoot: BEFORE_ROOT,
          installRoot: INSTALL_ROOT,
          moduleExtension: ".ts",
          fileText,
          path,
        }).read({});
        assert(selection.outcome === "ok", "the pair's version 1 selection file loads");
        const projection = await VERSION_ONE_PROJECTION.prepare({
          repoRoot: scratch,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          trackedPaths: [],
          clauses: [
            selection.value.bindings[0].clause,
            selection.value.bindings[1].clause,
            selection.value.bindings[2].clause,
            selection.value.bindings[3].clause,
            selection.value.bindings[4].clause,
            selection.value.bindings[5].clause,
            selection.value.bindings[6].clause,
            selection.value.bindings[7].clause,
          ],
          records: VERSION_ONE_RECORDS,
        });
        assert(projection.outcome === "ok", "the pair's version 1 projection is written");
        const { ESLint } = await modules.eslint();
        const eslint = new ESLint({ cwd: scratch, overrideConfigFile: "disciplines.eslint.mjs" });
        const config = resolvedConfigSchema.parse(
          await eslint.calculateConfigForFile(expected.file),
        );
        assert.isDefined(config);
        expect(config.rules).toEqual(expected.versionOneRules);
      },
    );

    it.each(PROBED_FILES)(
      "version 2 enables the same rules and options on $file",
      async (expected) => {
        const scratch = absolutePathSchema.parse(`${versionTwo}/${expected.scratch}`);
        expect([
          directoryTree.remove({ path: scratch }),
          directory.create({ path: scratch }),
        ]).toEqual([DONE, DONE]);
        const stages = versionTwoStagesOver({
          ports: {
            ...VERSION_TWO_HOST,
            modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
            git: {
              trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
              changedSince: vi.fn<GitPort["changedSince"]>(),
              contentInBase: vi.fn<GitPort["contentInBase"]>(),
              textInBase: vi.fn<GitPort["textInBase"]>(),
              renamedSince: vi.fn<GitPort["renamedSince"]>(),
            },
            gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
            recordsSourceOf: vi.fn<RecordsSourceOf>(),
          },
          locations: VERSION_TWO_LOCATIONS,
        });
        const catalogue = stages.catalogue();
        assert(catalogue.outcome === "ok", "this repository's catalogue reads");
        const settings = stages.settings({ catalogue: catalogue.value });
        assert(settings.outcome === "ok", "the pair's version 2 settings file loads");
        const checks = projectedNamedChecksOf({
          checks: catalogue.value.checks,
          bindings: [
            settings.value.selection.selected[0].binding,
            settings.value.selection.selected[1].binding,
            settings.value.selection.selected[2].binding,
            settings.value.selection.selected[3].binding,
            settings.value.selection.selected[4].binding,
            settings.value.selection.selected[5].binding,
            settings.value.selection.selected[6].binding,
            settings.value.selection.selected[7].binding,
          ],
        });
        assert(checks.outcome === "ok", "the pair's version 2 checks project");
        const text = checksProjectionText({
          pluginImport: PLUGIN_IMPORT,
          checks: checks.value,
          answered: VERSION_TWO_ANSWERED,
        });
        expect(fileText.write({ path: `${scratch}/hone.eslint.mjs`, text })).toEqual(DONE);
        const { ESLint } = await modules.eslint();
        const eslint = new ESLint({ cwd: scratch, overrideConfigFile: "hone.eslint.mjs" });
        const config = resolvedConfigSchema.parse(
          await eslint.calculateConfigForFile(expected.file),
        );
        assert.isDefined(config);
        expect(config.rules).toEqual(expected.versionTwoRules);
      },
    );
  },
);

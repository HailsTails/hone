import { afterAll, assert, describe, expect, it, vi } from "vitest";

import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import type { SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import type { ExceptionRecord } from "../domain/records/discipline-exceptions/exception-record.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { readBoundCatalogue } from "../infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import { createSelectionRepository } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { createEslintRunner } from "../infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import {
  type AnsweredFile,
  checksProjectionText,
} from "../infrastructure/engines/eslint/runner/projection/checks-projection.ts";
import { projectedChecksOf } from "../infrastructure/engines/eslint/runner/projection/projected-checks.ts";
import { eslint9ToolchainModules } from "../infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import { resolvedConfigSchema } from "../infrastructure/engines/eslint/runner/toolchain/eslint-config-schema.ts";
import { createEslintPort } from "../infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import type { EslintClass } from "../infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import { loadEslintToolchain } from "../infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
} from "../infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { createDefaultDirectoryTreePort } from "../infrastructure/node/file-system/directory-tree-port.ts";
import { createDefaultFileRemovalPort } from "../infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

const DEVELOPMENT_PEERS = defaultEslintToolchainPeers({
  installRoot: `${import.meta.dirname}/../..`,
  installForm: "source",
});

const ESLINT_MODULES: Readonly<Record<EslintLine, EslintToolchainModules>> = {
  "eslint-10": DEVELOPMENT_PEERS.modules,
  "eslint-9": eslint9ToolchainModules,
};

const eslintClassOn = (request: { readonly line: EslintLine }): Promise<EslintClass> =>
  ESLINT_MODULES[request.line].eslint().then((eslintModule) => eslintModule.ESLint);

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({
  path: path.join({ segments: [import.meta.dirname, "..", ".."] }),
});

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

const BEFORE_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "before"] }) });

const AFTER_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "after"] }) });

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
  { symptom: "claimed-type", file: LEGACY },
  { symptom: "rebinding", file: LEGACY },
  { symptom: "positional-parameters", file: WIDE },
  { symptom: "test-switched-off", check: "skipped-tests", file: SKIPPING },
];

const PROBED_FILES: readonly string[] = [
  "src/kept.ts",
  "src/legacy.ts",
  "src/wide.ts",
  "src/view.tsx",
  "tools/build.mts",
  "index.cts",
  "packages/web/src/deep/kept.ts",
  "src/skipping.test.ts",
];

const NON_NULL_ASSERTIONS_V1 = "hone-cd2/no-restricted-syntax";
const NAMING_CONVENTION_V1 = "hone-cd6/naming-convention";
const CLASS_SYNTAX_V1 = "hone/no-class-authoring";
const STATIC_ONLY_CLASS_V1 = "hone/no-extraneous-class";
const FOCUSED_TESTS_V1 = "hone-cd27/focused-tests";
const SKIPPED_TESTS_V1 = "hone-cd27/skipped-tests";
const PARAMETER_COUNT_V1 = "hone-cd40/max-params";
const PARAMETER_REASSIGNMENT_V1 = "hone-cd44/no-param-reassign";

const NON_NULL_ASSERTIONS_V2 = "hone/claimed-type#non-null-assertions";
const NAMING_CONVENTION_V2 = "hone/name-off-its-casing#naming-convention";
const CLASS_SYNTAX_V2 = "hone/authored-class-or-this#class-keyword";
const STATIC_ONLY_CLASS_V2 = "hone/authored-class-or-this#static-members-only";
const FOCUSED_TESTS_V2 = "hone/test-switched-off#focused-tests";
const SKIPPED_TESTS_V2 = "hone/test-switched-off#skipped-tests";
const PARAMETER_COUNT_V2 = "hone/positional-parameters#parameter-count";
const PARAMETER_REASSIGNMENT_V2 = "hone/rebinding#parameter-reassignment";

const specifierOf = (request: { readonly modulePath: string }): string => {
  const location = path.relative({ from: import.meta.dirname, to: request.modulePath });
  assert(location.relation === "within-root", `${request.modulePath} is on this test's root`);
  return import.meta.resolve(location.path);
};

const toolCatalogue = (): SymptomCatalogue => {
  const reading = readBoundCatalogue({
    directory: createDefaultDirectoryPort({}),
    fileText,
    path,
    ruleSetRoot: INSTALL_ROOT,
    installRoot: INSTALL_ROOT,
  });
  assert(reading.outcome === "ok", "this repository's catalogue reads");
  assert(reading.value.held === "catalogue", "this repository holds a catalogue");
  return reading.value.catalogue;
};

const versionOneSelection = createSelectionRepository({
  repoRoot: BEFORE_ROOT,
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  fileText,
  path,
}).read({});
assert(versionOneSelection.outcome === "ok", "the pair's version 1 selection file loads");

const [
  NON_NULL_ASSERTIONS,
  NAMING_CONVENTION,
  CLASS_SYNTAX,
  STATIC_ONLY_CLASS,
  FOCUSED_TESTS,
  SKIPPED_TESTS,
  PARAMETER_COUNT,
  PARAMETER_REASSIGNMENT,
] = versionOneSelection.value.bindings;
assert.isDefined(NON_NULL_ASSERTIONS, "the version 1 selection binds CD-2");
assert.isDefined(NAMING_CONVENTION, "the version 1 selection binds CD-6");
assert.isDefined(CLASS_SYNTAX, "the version 1 selection binds CD-14 class-syntax");
assert.isDefined(STATIC_ONLY_CLASS, "the version 1 selection binds CD-14 static-only-class");
assert.isDefined(FOCUSED_TESTS, "the version 1 selection binds CD-27 focused-tests");
assert.isDefined(SKIPPED_TESTS, "the version 1 selection binds CD-27 skipped-tests");
assert.isDefined(PARAMETER_COUNT, "the version 1 selection binds CD-40");
assert.isDefined(PARAMETER_REASSIGNMENT, "the version 1 selection binds CD-44");

const directory = createDefaultDirectoryPort({});

const directoryTree = createDefaultDirectoryTreePort({});

const SCRATCH = resolvedPath({
  path: path.join({
    segments: [INSTALL_ROOT, "artefacts", `projection-pair-${globalThis.crypto.randomUUID()}`],
  }),
});

const madeScratch = directory.create({ path: SCRATCH });

assert(madeScratch.outcome === "ok", "a scratch folder is made for the two projections");

const eslintToolchain = await loadEslintToolchain({ peers: DEVELOPMENT_PEERS });
assert(eslintToolchain.outcome === "ok", "the eslint toolchain loads from the development install");

const versionOneProjection = await createEslintRunner({
  fileText,
  fileRemoval: createDefaultFileRemovalPort({}),
  modules: createDefaultModuleLoaderPort({}),
  path,
  eslint: createEslintPort({ toolchain: eslintToolchain.value }),
  moduleExtension: ".ts",
}).project({
  repoRoot: SCRATCH,
  installRoot: INSTALL_ROOT,
  declaredConfigRoots: [],
  trackedPaths: [],
  clauses: [
    NON_NULL_ASSERTIONS.clause,
    NAMING_CONVENTION.clause,
    CLASS_SYNTAX.clause,
    STATIC_ONLY_CLASS.clause,
    FOCUSED_TESTS.clause,
    SKIPPED_TESTS.clause,
    PARAMETER_COUNT.clause,
    PARAMETER_REASSIGNMENT.clause,
  ],
  records: VERSION_ONE_RECORDS,
});
assert(versionOneProjection.outcome === "ok", "the pair's version 1 projection is written");

const versionTwoStages = versionTwoStagesOver({
  ports: {
    fileText,
    path,
    modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
    engine: createDefaultEnginePort({}),
    git: {
      trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
      changedSince: vi.fn<GitPort["changedSince"]>(),
      contentInBase: vi.fn<GitPort["contentInBase"]>(),
      textInBase: vi.fn<GitPort["textInBase"]>(),
      renamedSince: vi.fn<GitPort["renamedSince"]>(),
    },
    gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
    directory,
    recordsSourceOf: vi.fn<RecordsSourceOf>(),
  },
  locations: {
    repoRoot: AFTER_ROOT,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
  },
});

const versionTwoSettings = versionTwoStages.settings({ catalogue: toolCatalogue() });
assert(versionTwoSettings.outcome === "ok", "the pair's version 2 settings file loads");

const versionTwoChecks = projectedChecksOf({
  checks: toolCatalogue().checks,
  bindings: versionTwoSettings.value.selection.bindings,
});
assert(versionTwoChecks.outcome === "ok", "the pair's version 2 checks project");

const writtenConfig = (request: { readonly name: string; readonly text: string }): string => {
  const configPath = path.join({ segments: [SCRATCH, request.name] });
  const written = fileText.write({ path: configPath, text: request.text });
  assert(written.outcome === "ok", `${request.name} is written`);
  return configPath;
};

const VERSION_ONE_CONFIG = path.join({ segments: [SCRATCH, "disciplines.eslint.mjs"] });

const VERSION_TWO_CONFIG = writtenConfig({
  name: "version-two.eslint.mjs",
  text: checksProjectionText({
    pluginImport: specifierOf({
      modulePath: path.join({ segments: [INSTALL_ROOT, "src", "eslint-plugin.ts"] }),
    }),
    checks: versionTwoChecks.value,
    answered: VERSION_TWO_ANSWERED,
  }),
});

const resolvedRules = async (request: {
  readonly line: EslintLine;
  readonly config: string;
  readonly file: string;
}) => {
  const Eslint = await eslintClassOn({ line: request.line });
  const resolved = await new Eslint({
    cwd: SCRATCH,
    overrideConfigFile: request.config,
  }).calculateConfigForFile(path.join({ segments: [SCRATCH, request.file] }));
  const config = resolvedConfigSchema.parse(resolved);
  assert.isDefined(config);
  const { rules } = config;
  assert.isDefined(rules);
  return rules;
};

afterAll(() => {
  const removed = directoryTree.remove({ path: SCRATCH });
  assert(removed.outcome === "ok", "the scratch folder is removed");
});

describe.each(ESLINT_LINES)("on %s, the version 1 projection and its version 2 form", (line) => {
  it.each(PROBED_FILES)("enable the same rules with the same options on %s", async (file) => {
    const before = await resolvedRules({ line, config: VERSION_ONE_CONFIG, file });
    const after = await resolvedRules({ line, config: VERSION_TWO_CONFIG, file });
    expect(after).toEqual({
      [NON_NULL_ASSERTIONS_V2]: before[NON_NULL_ASSERTIONS_V1],
      [NAMING_CONVENTION_V2]: before[NAMING_CONVENTION_V1],
      [CLASS_SYNTAX_V2]: before[CLASS_SYNTAX_V1],
      [STATIC_ONLY_CLASS_V2]: before[STATIC_ONLY_CLASS_V1],
      [FOCUSED_TESTS_V2]: before[FOCUSED_TESTS_V1],
      [SKIPPED_TESTS_V2]: before[SKIPPED_TESTS_V1],
      [PARAMETER_COUNT_V2]: before[PARAMETER_COUNT_V1],
      [PARAMETER_REASSIGNMENT_V2]: before[PARAMETER_REASSIGNMENT_V1],
    });
  });
});

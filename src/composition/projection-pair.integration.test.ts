import { afterAll, assert, describe, expect, it, vi } from "vitest";
import { createSelectionRepository } from "../infrastructure/disciplines-file/consumer-selection.ts";
import type { ExceptionRecord } from "../domain/records/discipline-exceptions/exception-record.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { createSymptomCatalogueRepository } from "../infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { clauseAddressSchema } from "../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../infrastructure/hone-records-folder/repo-path.ts";
import { type AnsweredFile, checksProjectionText } from "../infrastructure/engines/eslint/runner/projection/checks-projection.ts";
import { projectedChecksOf } from "../infrastructure/engines/eslint/runner/projection/projected-checks.ts";
import { resolvedConfigSchema } from "../infrastructure/engines/eslint/runner/toolchain/eslint-config-schema.ts";
import { type ProjectedPiece, projectionText } from "../infrastructure/engines/eslint/runner/projection/projection-text.ts";
import { createDefaultDirectoryTreePort } from "../infrastructure/node/file-system/directory-tree-port.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { checksOf } from "../domain/language-layer/check-address.ts";
import type { SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import type { ClauseBinding } from "../domain/settings/selection/selection.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import { checkRuleIdOf, runsOnEslint } from "../infrastructure/engines/eslint/runner/hone-plugin/check-rule-id.ts";
import { type EslintPieceSettings, eslintPieceSettingsSchema, ruleOptionsOf } from "../infrastructure/engines/eslint/runner/pieces/eslint-piece-settings-schema.ts";
import type { EslintClass } from "../infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, type EslintToolchainModules } from "../infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { eslint9ToolchainModules } from "../infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

const DEVELOPMENT_PEERS = defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../..`, installForm: "source" });

const ESLINT_MODULES: Readonly<Record<EslintLine, EslintToolchainModules>> = {
  "eslint-10": DEVELOPMENT_PEERS.modules,
  "eslint-9": eslint9ToolchainModules,
};

const eslintClassOn = (request: { readonly line: EslintLine }): Promise<EslintClass> =>
  ESLINT_MODULES[request.line].eslint().then((eslintModule) => eslintModule.ESLint);

type SpecifierOf = (request: { readonly modulePath: string }) => string;

type SettledBinding = { readonly binding: ClauseBinding; readonly settings: EslintPieceSettings };

const ESLINT_MECHANISM = "eslint";

const settledBindingsOf = (request: { readonly bindings: readonly ClauseBinding[] }): readonly SettledBinding[] =>
  request.bindings
    .filter((binding) => binding.mechanism === ESLINT_MECHANISM)
    .flatMap((binding) => {
      const settings = eslintPieceSettingsSchema.safeParse(binding.clause.settings);
      return settings.success ? [{ binding, settings: settings.data }] : [];
    });

const versionOneRuleIdOf = (request: { readonly settings: EslintPieceSettings }): string => `${request.settings.pluginNamespace}/${request.settings.rule}`;

const versionOnePiecesOf = (request: {
  readonly bindings: readonly ClauseBinding[];
  readonly path: PathPort;
  readonly specifierOf: SpecifierOf;
}): readonly ProjectedPiece[] => {
  const settledBindings = settledBindingsOf(request);
  return settledBindings
    .filter((settled, index) => settledBindings.findIndex((other) => other.settings.pluginNamespace === settled.settings.pluginNamespace) === index)
    .map((leader) => ({
      pluginNamespace: leader.settings.pluginNamespace,
      pluginImport: request.specifierOf({ modulePath: request.path.join({ segments: [leader.binding.clause.pieceRoot, leader.settings.pluginModule] }) }),
      clauses: settledBindings
        .filter((settled) => settled.settings.pluginNamespace === leader.settings.pluginNamespace)
        .map((settled) => ({
          address: settled.binding.clause.address,
          ruleId: versionOneRuleIdOf({ settings: settled.settings }),
          options: ruleOptionsOf({ settings: settled.settings }),
        })),
    }));
};

const checkRuleIdsOfBinding = (request: { readonly catalogue: Pick<SymptomCatalogue, "checks">; readonly settled: SettledBinding }): readonly string[] =>
  checksOf({ catalogue: request.catalogue, clause: request.settled.binding.clause.address })
    .filter((check) => runsOnEslint({ check }) === "eslint")
    .map((check) => checkRuleIdOf({ check }));

const inCheckRuleIds = <Entry>(request: {
  readonly catalogue: Pick<SymptomCatalogue, "checks">;
  readonly bindings: readonly ClauseBinding[];
  readonly rules: Readonly<Record<string, Entry>>;
}): Readonly<Record<string, Entry>> => {
  const renames = new Map(
    settledBindingsOf(request).flatMap((settled) =>
      checkRuleIdsOfBinding({ catalogue: request.catalogue, settled }).map((ruleId): readonly [string, string] => [versionOneRuleIdOf(settled), ruleId]),
    ),
  );
  return Object.fromEntries(Object.entries(request.rules).map(([ruleId, entry]) => [renames.get(ruleId) ?? ruleId, entry]));
};

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "..", ".."] }) });

const PAIR_ROOT = path.join({ segments: [import.meta.dirname, "..", "infrastructure", "engines", "eslint", "runner", "projection", "projection-pair"] });

const BEFORE_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "before"] }) });

const AFTER_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "after"] }) });

const ESLINT = mechanismIdSchema.parse("eslint");

const LEGACY = repoPathSchema.parse("src/legacy.ts");

const WIDE = repoPathSchema.parse("src/wide.ts");

const SKIPPING = repoPathSchema.parse("src/skipping.test.ts");

const VERSION_ONE_RECORDS: readonly ExceptionRecord[] = [
  { kind: "file-carve-out", clause: clauseAddressSchema.parse("CD-2#non-null-assertions"), mechanism: ESLINT, file: LEGACY },
  {
    kind: "authorised-location",
    clause: clauseAddressSchema.parse("CD-44#parameter-reassignment"),
    mechanism: ESLINT,
    file: LEGACY,
    reason: "a reducer rebinds its accumulator",
  },
  { kind: "file-carve-out", clause: clauseAddressSchema.parse("CD-40#parameter-count"), mechanism: ESLINT, file: WIDE },
  { kind: "file-carve-out", clause: clauseAddressSchema.parse("CD-27#skipped-tests"), mechanism: ESLINT, file: SKIPPING },
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

const specifierOf: SpecifierOf = ({ modulePath }) => {
  const location = path.relative({ from: import.meta.dirname, to: modulePath });
  assert(location.relation === "within-root", `${modulePath} is on this test's root`);
  return import.meta.resolve(location.path);
};

const toolCatalogue = (): SymptomCatalogue => {
  const reading = createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: INSTALL_ROOT }).read({});
  assert(reading.outcome === "ok", "this repository's catalogue reads");
  assert(reading.value.held === "catalogue", "this repository holds a catalogue");
  return reading.value.catalogue;
};

const versionOneBindings = (): readonly ClauseBinding[] => {
  const reading = createSelectionRepository({ repoRoot: BEFORE_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path }).read({});
  assert(reading.outcome === "ok", "the pair's version 1 selection file loads");
  return reading.value.bindings;
};

const versionTwoBindings = (): readonly ClauseBinding[] => {
  const stages = versionTwoStagesOver({
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
      directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
      recordsSourceOf: vi.fn<RecordsSourceOf>(),
    },
    locations: { repoRoot: AFTER_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", baseRevision: undefined },
  });
  const settings = stages.settings({ catalogue: toolCatalogue() });
  assert(settings.outcome === "ok", "the pair's version 2 settings file loads");
  return settings.value.selection.bindings;
};

const versionOneText = (): string =>
  projectionText({ selectedPieces: versionOnePiecesOf({ bindings: versionOneBindings(), path, specifierOf }), records: VERSION_ONE_RECORDS });

const versionTwoText = (): string => {
  const checks = projectedChecksOf({ checks: toolCatalogue().checks, bindings: versionTwoBindings() });
  assert(checks.outcome === "ok", "the pair's version 2 checks project");
  return checksProjectionText({
    pluginImport: specifierOf({ modulePath: path.join({ segments: [INSTALL_ROOT, "src", "eslint-plugin.ts"] }) }),
    checks: checks.value,
    answered: VERSION_TWO_ANSWERED,
  });
};

const directory = createDefaultDirectoryPort({});

const directoryTree = createDefaultDirectoryTreePort({});

const SCRATCH = resolvedPath({ path: path.join({ segments: [INSTALL_ROOT, "artefacts", `projection-pair-${globalThis.crypto.randomUUID()}`] }) });

const madeScratch = directory.create({ path: SCRATCH });

assert(madeScratch.outcome === "ok", "a scratch folder is made for the two projections");

const writtenConfig = (request: { readonly name: string; readonly text: string }): string => {
  const configPath = path.join({ segments: [SCRATCH, request.name] });
  const written = fileText.write({ path: configPath, text: request.text });
  assert(written.outcome === "ok", `${request.name} is written`);
  return configPath;
};

const VERSION_ONE_CONFIG = writtenConfig({ name: "version-one.eslint.mjs", text: versionOneText() });

const VERSION_TWO_CONFIG = writtenConfig({ name: "version-two.eslint.mjs", text: versionTwoText() });

const resolvedRules = async (request: { readonly line: EslintLine; readonly config: string; readonly file: string }) => {
  const Eslint = await eslintClassOn({ line: request.line });
  const resolved = await new Eslint({ cwd: SCRATCH, overrideConfigFile: request.config }).calculateConfigForFile(path.join({ segments: [SCRATCH, request.file] }));
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
    expect(after).toEqual(inCheckRuleIds({ catalogue: toolCatalogue(), bindings: versionOneBindings(), rules: before }));
  });
});

import { afterAll, assert, describe, expect, it } from "vitest";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { VersionOneWhyChain } from "../../../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import type { EmbeddedRunner } from "../../../protocol/embedded/embedded-runner-module-schema.ts";
import { toolchainBoundEmbeddedRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import { loadedEngineOf } from "../../../protocol/engine-run/engine-run.ts";
import { checkConformance } from "../../../protocol/conformance.ts";
import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import type { LoadedRunner } from "../../../../../application/ports/engine/runner-module.ts";
import { createDefaultDirectoryTreePort } from "../../../../node/file-system/directory-tree-port.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { createSelectionRepository } from "../../../../disciplines-file/consumer-selection.ts";
import { exceptionEntriesOfText, parseExceptionEntries, placedInSingleFile } from "../../../../discipline-exceptions-folder/exception-records.ts";
import { UNMEASURED_EXCEPTION_BASELINE } from "../../../../../domain/records/discipline-exceptions/exception-baseline.ts";
import { readDisciplineFile } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import type { ClauseDefinition } from "../../../../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { runner as walkerRunner } from "../../../audit/runner/runner.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../embedded-runner/create-eslint-runner.ts";
import { eslint9PieceModules, eslint9ToolchainModules } from "../toolchain/eslint-9/eslint-9-engine.ts";
import { createEslintPort, type EslintClass, type EslintPort, type EslintToolchain } from "../toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, type EslintToolchainModules, type EslintToolchainPeers, loadEslintToolchain } from "../toolchain/eslint-toolchain.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly pieceModules: (request: { readonly base: ModuleLoaderPort }) => ModuleLoaderPort;
};

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../../../../../..`, installForm: "source" });

const RUNNER_MODULE_SUFFIX = "src/infrastructure/engines/eslint/runner/runner.ts";

const LINES: Readonly<Record<EslintLine, LineDefinition>> = {
  "eslint-10": { eslintVersion: /^10\./, modules: DEVELOPMENT_PEERS.modules, pieceModules: (request) => request.base },
  "eslint-9": { eslintVersion: /^9\./, modules: eslint9ToolchainModules, pieceModules: eslint9PieceModules },
};

const loadedEslintToolchain = async (request: { readonly line: EslintLine }): Promise<EslintToolchain> => {
  const loaded = await loadEslintToolchain({ peers: { location: DEVELOPMENT_PEERS.location, modules: LINES[request.line].modules } });
  assert(loaded.outcome === "ok", `the ${request.line} toolchain loads from the development install`);
  assert(
    LINES[request.line].eslintVersion.test(loaded.value.eslintVersion),
    `the ${request.line} toolchain runs ESLint ${loaded.value.eslintVersion}`,
  );
  return loaded.value;
};

const eslintClassOn = (request: { readonly line: EslintLine }): Promise<EslintClass> =>
  LINES[request.line].modules.eslint().then((eslintModule) => eslintModule.ESLint);

const eslintPortOn = async (request: { readonly line: EslintLine }): Promise<EslintPort> =>
  createEslintPort({ toolchain: await loadedEslintToolchain(request) });

const pieceModulesOn = (request: { readonly line: EslintLine; readonly base: ModuleLoaderPort }): ModuleLoaderPort =>
  LINES[request.line].pieceModules({ base: request.base });

const eslintRunnerOn = (request: { readonly line: EslintLine }): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadedEslintToolchain(request).then((toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain })),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
        fileText: createDefaultFileTextPort({}),
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

const runnerModulesOn = (request: { readonly line: EslintLine; readonly base: ModuleLoaderPort }): ModuleLoaderPort => ({
  load: (load) =>
    load.path.replaceAll("\\", "/").endsWith(RUNNER_MODULE_SUFFIX)
      ? Promise.resolve({ outcome: "ok", value: { runner: eslintRunnerOn({ line: request.line }) } })
      : request.base.load(load),
});

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const slashedText = (text: string): string => text.replaceAll("\\", "/");

const overlaidFileText = (request: {
  readonly base: FileTextPort;
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
  const overlaid = (requested: string): string | undefined =>
    Object.entries(request.files).find(([name]) => slashedText(name) === slashedText(requested))?.[1];
  return {
    ...request.base,
    read: (reading) => {
      const text = overlaid(reading.path);
      return text === undefined ? request.base.read(reading) : { outcome: "ok", value: text };
    },
    exists: (probing) => (overlaid(probing.path) === undefined ? request.base.exists(probing) : "present"),
  };
};

const directory = createDefaultDirectoryPort({});

const directoryTree = createDefaultDirectoryTreePort({});

const madeDirectory = (request: { readonly path: string }): void => {
  const made = directory.create({ path: absolutePathSchema.parse(request.path) });
  assert(made.outcome === "ok", `${request.path} is made`);
};

const removedTree = (request: { readonly path: AbsolutePath }): void => {
  const removed = directoryTree.remove({ path: request.path });
  assert(removed.outcome === "ok", `${request.path} is removed`);
};

type ScratchRepositories = {
  readonly repositoryWith: (request: { readonly files: Readonly<Record<string, string>> }) => AbsolutePath;
  readonly removeAll: () => void;
};

const scratchRepositoriesUnder = (request: { readonly parent: string; readonly fileText: FileTextPort }): ScratchRepositories => {
  const made: AbsolutePath[] = [];
  return {
    repositoryWith: (repository) => {
      const folder = absolutePathSchema.parse(`${request.parent.replaceAll("\\", "/")}/scratch-${globalThis.crypto.randomUUID()}`);
      madeDirectory({ path: folder });
      made.push(folder);
      Object.entries(repository.files).forEach(([name, text]) => {
        request.fileText.write({ path: `${folder}/${name}`, text });
      });
      return folder;
    },
    removeAll: () => {
      made.forEach((folder) => {
        removedTree({ path: folder });
      });
    },
  };
};

const STORED_LINT_CONFIG_NAME = "lint-config.fixture";

const RESTORED_LINT_CONFIG_NAME = "eslint.config.mjs";

const MODULE_FILE = /\.mjs$/;

const RELATIVE_IMPORT = /from "(\.\.?\/[^"]*)"/g;

const SAME_FOLDER_MARK = "./";

type RehomedImports = {
  readonly text: string;
  readonly path: Pick<PathPort, "join" | "relative">;
  readonly fixtureRoot: string;
  readonly from: string;
  readonly to: string;
};

const OUTSIDE_THE_ROOT = "..";

const OUTSIDE_THE_ROOT_PREFIX = `${OUTSIDE_THE_ROOT}/`;

const leavesTheRoot = (request: { readonly path: string }): "leaves" | "stays" =>
  request.path === OUTSIDE_THE_ROOT || request.path.startsWith(OUTSIDE_THE_ROOT_PREFIX) ? "leaves" : "stays";

const placeOfTarget = (request: Omit<RehomedImports, "text"> & { readonly target: string }): "inside-the-fixture" | "outside-the-fixture" => {
  const inside = request.path.relative({ from: request.fixtureRoot, to: request.target });
  return inside.relation === "within-root" && leavesTheRoot({ path: inside.path }) === "stays" ? "inside-the-fixture" : "outside-the-fixture";
};

const rehomedSpecifier = (request: Omit<RehomedImports, "text"> & { readonly specifier: string }): string => {
  const target = request.path.join({ segments: [request.from, request.specifier] });
  if (placeOfTarget({ ...request, target }) === "inside-the-fixture") {
    return request.specifier;
  }
  const location = request.path.relative({ from: request.to, to: target });
  if (location.relation === "different-root") {
    return target;
  }
  return location.path.startsWith(".") ? location.path : `${SAME_FOLDER_MARK}${location.path}`;
};

const rehomedImports = (request: RehomedImports): string =>
  request.text.replace(RELATIVE_IMPORT, (_whole, specifier: string) => `from "${rehomedSpecifier({ ...request, specifier })}"`);

type Dependencies = {
  readonly repositories: ScratchRepositories;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
};

type ListedEntry = { readonly path: string; readonly name: string; readonly entryKind: "file" | "directory" };

type EntryRequest = Dependencies & {
  readonly fixtureRoot: AbsolutePath;
  readonly repo: AbsolutePath;
  readonly entry: ListedEntry;
};

const slashed = (request: { readonly path: string }): string => request.path.replaceAll("\\", "/");

const restoredName = (request: { readonly name: string }): string =>
  request.name === STORED_LINT_CONFIG_NAME ? RESTORED_LINT_CONFIG_NAME : request.name;

const restoredLocation = (request: { readonly entry: ListedEntry }): string => {
  const shown = slashed({ path: request.entry.path });
  const folder = shown.slice(0, shown.length - request.entry.name.length);
  return `${folder}${restoredName({ name: request.entry.name })}`;
};

const failed = (request: { readonly what: string; readonly detail: string }): never => {
  throw new Error(`${request.what}: ${request.detail}`);
};

const copiedFolder = (request: EntryRequest): void => {
  madeDirectory({ path: `${request.repo}/${slashed({ path: request.entry.path })}` });
};

const textOf = (request: EntryRequest): string => {
  const read = request.fileText.read({ path: `${request.fixtureRoot}/${slashed({ path: request.entry.path })}` });
  return read.outcome === "ok" ? read.value : failed({ what: `a fixture file could not be read at ${request.entry.path}`, detail: read.error.detail });
};

const restoredText = (request: EntryRequest): string => {
  const text = textOf(request);
  if (!MODULE_FILE.test(restoredName({ name: request.entry.name }))) {
    return text;
  }
  const folder = request.path.directoryOf({ path: slashed({ path: request.entry.path }) });
  return rehomedImports({
    text,
    path: request.path,
    fixtureRoot: request.fixtureRoot,
    from: request.path.join({ segments: [request.fixtureRoot, folder] }),
    to: request.path.join({ segments: [request.repo, folder] }),
  });
};

const copiedFile = (request: EntryRequest): void => {
  const target = `${request.repo}/${restoredLocation({ entry: request.entry })}`;
  const written = request.fileText.write({ path: target, text: restoredText(request) });
  if (written.outcome !== "ok") {
    failed({ what: `a fixture file could not be written at ${target}`, detail: written.error.detail });
  }
};

const copiedEntry = (request: EntryRequest): void => {
  if (request.entry.entryKind === "directory") {
    copiedFolder(request);
    return;
  }
  copiedFile(request);
};

type TextFiles = Readonly<Record<string, string>>;

const NO_TEXT_FILES: TextFiles = {};

type RestoredFixture = { readonly fixtureRoot: AbsolutePath; readonly textFiles: TextFiles };

type RestoredFixtureRepositories = {
  readonly restoredFrom: (request: RestoredFixture) => AbsolutePath;
};

const writtenText = (request: Dependencies & { readonly repo: AbsolutePath; readonly file: string; readonly text: string }): void => {
  const target = `${request.repo}/${request.file}`;
  madeDirectory({ path: request.path.directoryOf({ path: target }) });
  const written = request.fileText.write({ path: target, text: request.text });
  if (written.outcome !== "ok") {
    failed({ what: `a fixture text could not be written at ${target}`, detail: written.error.detail });
  }
};

const listedTree = (request: { readonly root: AbsolutePath }): readonly ListedEntry[] => {
  const listed = directoryTree.list({ path: request.root });
  assert(listed.outcome === "ok", `${request.root} lists for restoring`);
  return listed.value.map(({ path: entryPath, name, kind }): ListedEntry => ({ path: entryPath, name, entryKind: kind }));
};

const restoredOnce = (request: Dependencies & RestoredFixture): AbsolutePath => {
  const listed = listedTree({ root: request.fixtureRoot });
  const repo = request.repositories.repositoryWith({ files: {} });
  const folders = listed.filter(({ entryKind }) => entryKind === "directory");
  const files = listed.filter(({ entryKind }) => entryKind === "file");
  [...folders, ...files].forEach((entry) => {
    copiedEntry({ ...request, repo, entry });
  });
  Object.entries(request.textFiles).forEach(([file, text]) => {
    writtenText({ ...request, repo, file, text });
  });
  const resolved = request.path.resolve({ path: repo });
  return resolved.outcome === "ok" ? resolved.value : failed({ what: `the restored repository at ${repo} has no absolute path`, detail: resolved.error.path });
};

const restoredFixtureRepositoriesOver = (dependencies: Dependencies): RestoredFixtureRepositories => {
  const restoredByFixture = new Map<string, AbsolutePath>();
  return {
    restoredFrom: (fixture) => {
      const key = JSON.stringify([fixture.fixtureRoot, fixture.textFiles]);
      const known = restoredByFixture.get(key);
      if (known !== undefined) {
        return known;
      }
      const repo = restoredOnce({ ...dependencies, ...fixture });
      restoredByFixture.set(key, repo);
      return repo;
    },
  };
};

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") };

const CLASS_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const ESLINT_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/CD-14`,
  clauseSettings: {},
  edition: editionOf("1"),
  settings: { pluginNamespace: "hone", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" },
};

const WALKER_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/audit/CD-14`,
  clauseSettings: {},
  edition: editionOf("1"),
  settings: { module: "class-syntax.ts" },
};

const fileText = createDefaultFileTextPort({});

const modules = createDefaultModuleLoaderPort({});

const path = createDefaultPathPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText });

const restoredFixtures = restoredFixtureRepositoriesOver({ repositories, fileText, path });

afterAll(() => {
  repositories.removeAll();
});

const consumerRepoWithText = (request: { readonly name: string; readonly textFiles: TextFiles }): AbsolutePath =>
  restoredFixtures.restoredFrom({ fixtureRoot: absolutePathSchema.parse(`${import.meta.dirname}/${request.name}`), textFiles: request.textFiles });

const consumerRepo = (request: { readonly name: string }): AbsolutePath => consumerRepoWithText({ name: request.name, textFiles: NO_TEXT_FILES });

const TYPESCRIPT_FILE = /\.ts$/;

const fixtureRecords = (request: { readonly name: string }): readonly ExceptionRecord[] => {
  const repoRoot = absolutePathSchema.parse(`${import.meta.dirname}/${request.name}`);
  const selection = createSelectionRepository({ repoRoot, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path }).read({});
  assert(selection.outcome === "ok", `${request.name} selects its clauses`);
  const text = fileText.read({ path: `${repoRoot}/discipline-exceptions.json` });
  assert(text.outcome === "ok", `${request.name} holds its records`);
  const reading = parseExceptionEntries({
    entries: placedInSingleFile({ entries: exceptionEntriesOfText({ text: text.value }) }),
    selection: selection.value.selection,
    baseline: UNMEASURED_EXCEPTION_BASELINE,
    fileExceptionWhyChains: selection.value.fileExceptionWhyChains,
  });
  assert.isEmpty(reading.invalid, `${request.name}'s records are all valid`);
  return reading.records;
};

const runOf = (request: {
  readonly name: string;
  readonly tracked: readonly RepoPath[];
  readonly line: EslintLine;
  readonly records?: readonly ExceptionRecord[];
  readonly textFiles?: TextFiles;
}) =>
  eslintRunnerOn({ line: request.line }).run({
    repoRoot: consumerRepoWithText({ name: request.name, textFiles: request.textFiles ?? NO_TEXT_FILES }),
    installRoot: INSTALL_ROOT,
    declaredConfigRoots: [],
    files: request.tracked.filter((file) => TYPESCRIPT_FILE.test(file)),
    trackedPaths: request.tracked,
    clauses: [ESLINT_CLAUSE],
    records: request.records ?? [],
  });

const classHit = (request: { readonly file: string; readonly line: number }) => ({
  clause: CLASS_SYNTAX,
  file: request.file,
  anchor: { line: request.line, column: 7 },
  snippet: "export class Kept {}",
});

describe.each(ESLINT_LINES)("real %s config resolution behind the ESLint runner's query instance, over a consumer repository", (line) => {
  it("reports an unrecorded override block placed after the projection as a config-override", async () => {
    await expect(runOf({ name: "override-after", tracked: [repoPathOf("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        hits: [classHit({ file: "x.ts", line: 1 })],
        nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts" }],
        projection: "current",
      },
    });
  });

  it("reports an unrecorded global ignore over a file holding a class, and core still finds the class", async () => {
    await expect(runOf({ name: "global-ignore", tracked: [repoPathOf("gen/g.ts"), repoPathOf("src/clean.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        hits: [classHit({ file: "gen/g.ts", line: 1 })],
        nativeExceptions: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "gen/g.ts" }],
        projection: "current",
      },
    });
  });

  it("reports a rule the team sets to severity 0 everywhere with no records as config-overrides, the projection still in effect", async () => {
    await expect(runOf({ name: "severity-zero", tracked: [repoPathOf("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        hits: [classHit({ file: "x.ts", line: 1 })],
        nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts" }],
        projection: "current",
      },
    });
  });

  it("finds no projection in effect when a later team block sets a recorded file back to error", async () => {
    await expect(
      runOf({ name: "re-enabled-record", tracked: [repoPathOf("src/owned.ts")], line, records: fixtureRecords({ name: "re-enabled-record" }) }),
    ).resolves.toMatchObject({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "not-included", unprojectedFolders: [] } });
  });
});

describe.each(ESLINT_LINES)("eslint-suppressions.json files and package.json lint scripts read by the ESLint runner on %s, over a consumer repository", (line) => {
  it("reports an entry in the default eslint-suppressions.json as a suppression-entry", async () => {
    await expect(
      runOf({ name: "suppression-default", tracked: [repoPathOf("supp/a.ts"), repoPathOf("eslint-suppressions.json")], line }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        hits: [classHit({ file: "supp/a.ts", line: 1 })],
        nativeExceptions: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/a.ts",
            location: "eslint-suppressions.json",
          },
        ],
      },
    });
  });

  it("reports entries in suppressions files a package.json script names in space and equals form, a dormant one included", async () => {
    await expect(
      runOf({
        line,
        name: "suppression-scripted",
        tracked: [
          repoPathOf("supp/b.ts"),
          repoPathOf("supp/clean.ts"),
          repoPathOf("package.json"),
          repoPathOf("custom/supp.json"),
          repoPathOf("custom/supp2.json"),
        ],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        hits: [classHit({ file: "supp/b.ts", line: 1 })],
        nativeExceptions: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/b.ts",
            location: "custom/supp.json",
          },
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/clean.ts",
            location: "custom/supp2.json",
          },
        ],
      },
    });
  });

  it("reports an entry in a nested tracked eslint-suppressions.json against its own directory", async () => {
    await expect(
      runOf({
        line,
        name: "suppression-nested",
        tracked: [repoPathOf("packages/a/src/n.ts"), repoPathOf("packages/a/eslint-suppressions.json")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        nativeExceptions: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "packages/a/src/n.ts",
            location: "packages/a/eslint-suppressions.json",
          },
        ],
      },
    });
  });

  it("reports each command-line option that weakens the run, and neither one that changes nothing ESLint already does nor a rule id that merely extends the selected one", async () => {
    await expect(
      runOf({
        line,
        name: "command-line-options",
        tracked: [repoPathOf("src/plain.ts"), repoPathOf("package.json")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "--rule hone/no-class-authoring: off",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "-c alt.config.mjs",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:suppress",
            option: "--suppress-all",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:suppress",
            option: "--suppress-rule hone/no-class-authoring",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:hidden",
            option: "--ignore-pattern src/**",
          },
        ],
      },
    });
  });
});

const INLINE_FORM_FILES: readonly RepoPath[] = [
  repoPathOf("i/disable-file.ts"),
  repoPathOf("i/disable-file-named.ts"),
  repoPathOf("i/disable-line.ts"),
  repoPathOf("i/disable-next-line.ts"),
  repoPathOf("i/rule-config.ts"),
  repoPathOf("i/other-rule.ts"),
  repoPathOf("i/enable.ts"),
  repoPathOf("i/global.ts"),
];

const INLINE_FORM_TEXTS: TextFiles = {
  "i/disable-file-named.ts": "/* eslint-disable hone/no-class-authoring */\nexport class Kept {}\n",
  "i/disable-line.ts": "export const plain = 1;\nexport class Kept {} // eslint-disable-line hone/no-class-authoring\n",
  "i/disable-next-line.ts": "// eslint-disable-next-line hone/no-class-authoring\nexport class Kept {}\n",
  "i/rule-config.ts": '/* eslint hone/no-class-authoring: "off" */\nexport class Kept {}\n',
};

const inlineFormsRunOf = (request: { readonly line: EslintLine }) =>
  runOf({ name: "inline-forms", textFiles: INLINE_FORM_TEXTS, tracked: INLINE_FORM_FILES, line: request.line });

describe.each(ESLINT_LINES)("inline configuration comments read by the ESLint runner's governance rule on real %s, over a consumer repository", (line) => {
  it("reports each disable and rule-config form naming the selected rule and none of the rest", async () => {
    await expect(inlineFormsRunOf({ line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-file.ts",
            line: 1,
            text: "/* eslint-disable */",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-file-named.ts",
            line: 1,
            text: "/* eslint-disable hone/no-class-authoring */",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            line: 2,
            text: "// eslint-disable-line hone/no-class-authoring",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-next-line.ts",
            line: 1,
            text: "// eslint-disable-next-line hone/no-class-authoring",
          },
          {
            kind: "inline-rule-config",
            clause: CLASS_SYNTAX,
            file: "i/rule-config.ts",
            line: 1,
            text: '/* eslint hone/no-class-authoring: "off" */',
          },
        ],
      },
    });
  });

  it("still finds the class in every file whatever its inline comment says", async () => {
    await expect(inlineFormsRunOf({ line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        hits: [
          classHit({ file: "i/disable-file.ts", line: 2 }),
          classHit({ file: "i/disable-file-named.ts", line: 2 }),
          {
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            anchor: { line: 2, column: 7 },
            snippet: "export class Kept {} // eslint-disable-line hone/no-class-authoring",
          },
          classHit({ file: "i/disable-next-line.ts", line: 2 }),
          classHit({ file: "i/rule-config.ts", line: 2 }),
          classHit({ file: "i/other-rule.ts", line: 2 }),
          classHit({ file: "i/enable.ts", line: 2 }),
          classHit({ file: "i/global.ts", line: 2 }),
        ],
      },
    });
  });
});

describe.each(ESLINT_LINES)("real %s glob matching of the generated projection's record blocks, over a consumer repository", (line) => {
  it("matches route/[id].ts by its authorised location, leaving the projection current with no native exception", async () => {
    await expect(
      runOf({
        name: "route-brackets",
        tracked: [repoPathOf("route/[id].ts"), repoPathOf("route/i.ts")],
        line,
        records: fixtureRecords({ name: "route-brackets" }),
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        hits: [classHit({ file: "route/[id].ts", line: 1 }), classHit({ file: "route/i.ts", line: 1 })],
        nativeExceptions: [],
        projection: "current",
      },
    });
  });
});

describe.each(ESLINT_LINES)("the ESLint runner's projection states under real %s, over a consumer repository", (line) => {
  it("reports the projection missing when it was never generated", async () => {
    await expect(runOf({ name: "projection-missing", tracked: [repoPathOf("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { hits: [], projection: "missing" },
    });
  });

  it("reports the projection out-of-date when it was hand-edited", async () => {
    await expect(runOf({ name: "projection-hand-edited", tracked: [repoPathOf("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { hits: [classHit({ file: "x.ts", line: 1 })], projection: "out-of-date" },
    });
  });

  it("reports no projection in effect when the team config does not import the projection", async () => {
    await expect(runOf({ name: "projection-not-imported", tracked: [repoPathOf("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], projection: "not-included", unprojectedFolders: [] },
    });
  });

  it("reports no projection in effect when the piece's fragment is imported instead of the projection beside an authorised location", async () => {
    await expect(
      runOf({
        line,
        name: "fragment-not-projection",
        tracked: [repoPathOf("src/owned.ts"), repoPathOf("src/clean.ts")],
        records: fixtureRecords({ name: "fragment-not-projection" }),
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], projection: "not-included", unprojectedFolders: [] },
    });
  });
});

const SHARED_CASE_FILES: readonly RepoPath[] = [
  repoPathOf("src/decl.ts"),
  repoPathOf("src/expr.ts"),
  repoPathOf("src/default.ts"),
  repoPathOf("src/abstract.ts"),
  repoPathOf("src/nested.ts"),
  repoPathOf("src/space.ts"),
  repoPathOf("src/anon.ts"),
];

const SHARED_CASES_RUN = {
  repoRoot: consumerRepo({ name: "fr3-anchors" }),
  installRoot: INSTALL_ROOT,
  declaredConfigRoots: [],
  files: SHARED_CASE_FILES,
  trackedPaths: SHARED_CASE_FILES,
};

const EXPECTED_SHARED_HITS = [
  { clause: CLASS_SYNTAX, file: "src/decl.ts", anchor: { line: 1, column: 7 }, snippet: "export class Alpha {}" },
  { clause: CLASS_SYNTAX, file: "src/expr.ts", anchor: { line: 1, column: 20 }, snippet: "export const Beta = class {};" },
  { clause: CLASS_SYNTAX, file: "src/default.ts", anchor: { line: 2, column: 0 }, snippet: "class {}" },
  {
    clause: CLASS_SYNTAX,
    file: "src/abstract.ts",
    anchor: { line: 1, column: 16 },
    snippet: "export abstract class Gamma {}",
  },
  { clause: CLASS_SYNTAX, file: "src/nested.ts", anchor: { line: 2, column: 2 }, snippet: "class Delta {}" },
  { clause: CLASS_SYNTAX, file: "src/space.ts", anchor: { line: 2, column: 9 }, snippet: "export class Epsilon {}" },
  {
    clause: CLASS_SYNTAX,
    file: "src/anon.ts",
    anchor: { line: 1, column: 25 },
    snippet: "export const zeta = new (class {})();",
  },
];

const CLASS_SYNTAX_MEASURED_ON_SHARED_CASES = [
  { clause: CLASS_SYNTAX, file: "src/decl.ts" },
  { clause: CLASS_SYNTAX, file: "src/expr.ts" },
  { clause: CLASS_SYNTAX, file: "src/default.ts" },
  { clause: CLASS_SYNTAX, file: "src/abstract.ts" },
  { clause: CLASS_SYNTAX, file: "src/nested.ts" },
  { clause: CLASS_SYNTAX, file: "src/space.ts" },
  { clause: CLASS_SYNTAX, file: "src/anon.ts" },
];

describe.each(ESLINT_LINES)("FR-3 over real files: the ESLint runner on real %s and the audit runner on real TypeScript", (line) => {
  it("give the same whole anchors for every flagged CD-14 shared case", async () => {
    const eslintRun = await eslintRunnerOn({ line }).run({ ...SHARED_CASES_RUN, records: [], clauses: [ESLINT_CLAUSE] });
    const walkerRun = await walkerRunner.run({ ...SHARED_CASES_RUN, clauses: [WALKER_CLAUSE] });
    expect({ eslint: eslintRun, audit: walkerRun }).toEqual({
      eslint: {
        outcome: "ok",
        value: { hits: EXPECTED_SHARED_HITS, nativeExceptions: [], projection: "current", slices: [], unprojectedFolders: [], measured: CLASS_SYNTAX_MEASURED_ON_SHARED_CASES },
      },
      audit: { outcome: "ok", value: { hits: EXPECTED_SHARED_HITS, nativeExceptions: [], measured: CLASS_SYNTAX_MEASURED_ON_SHARED_CASES } },
    });
  });
});

type MechanicalCases = Extract<ClauseDefinition, { readonly kind: "mechanical" }>["cases"];

const classSyntaxCases = (): MechanicalCases => {
  const loaded = readDisciplineFile({ fileText, path, ruleSetRoot: INSTALL_ROOT, discipline: disciplineIdOf("CD-14") });
  assert(loaded.outcome === "ok", "CD-14 discipline.json reads through the rule-set reader");
  const [classSyntax, libraryConstruction, staticOnlyClass, ...surplus] = loaded.value.clauses;
  assert.isDefined(classSyntax, "CD-14 declares a first clause");
  assert.isDefined(libraryConstruction, "CD-14 declares a second clause");
  assert.isDefined(staticOnlyClass, "CD-14 declares a third clause");
  assert.strictEqual(classSyntax.id, "class-syntax", "CD-14 declares class-syntax as its first clause");
  assert.strictEqual(libraryConstruction.id, "library-construction", "CD-14 declares the library-construction judgement clause second");
  assert.strictEqual(staticOnlyClass.id, "static-only-class", "CD-14 declares the static-only-class clause third");
  assert.isEmpty(surplus, "CD-14 declares exactly three clauses");
  assert(classSyntax.kind === "mechanical", "CD-14 declares class-syntax as a mechanical clause");
  return classSyntax.cases;
};

const CLASS_SYNTAX_CASES = classSyntaxCases();

const coreLoadedEslintRunner = async (request: { readonly line: EslintLine }): Promise<LoadedRunner> => {
  const loaded = await loadedEngineOf({
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    modules: runnerModulesOn({ line: request.line, base: modules }),
    path,
    mechanism: "eslint",
  });
  assert(loaded.outcome === "ok", "core loads the ESLint runner module");
  return loaded.value.runner;
};

describe.each(ESLINT_LINES)("checkConformance over the ESLint runner as core loads it, on real %s", (line) => {
  it("has no failures for CD-14#class-syntax over every CD-14 shared case", async () => {
    await expect(
      checkConformance({
        clause: ESLINT_CLAUSE,
        cases: [...CLASS_SYNTAX_CASES.flag, ...CLASS_SYNTAX_CASES.allow],
        runner: await coreLoadedEslintRunner({ line }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });
});

const ESLINT_PACKAGE_JSON = "node_modules/eslint/package.json";

const LINT_SCRIPT_PACKAGE_JSON = "package.json";

const eslintVersion = (request: { readonly version: string }): string => JSON.stringify({ name: "eslint", version: request.version });

const lintScript = (request: { readonly command: string }): string => JSON.stringify({ scripts: { lint: request.command } });

const monorepoRun = async (request: {
  readonly line: EslintLine;
  readonly name: string;
  readonly version: string;
  readonly lintCommand: string;
  readonly records: readonly ExceptionRecord[];
}) =>
  createEslintRunner({
    fileText: overlaidFileText({
      base: fileText,
      files: {
        [`${consumerRepo({ name: request.name })}/${ESLINT_PACKAGE_JSON}`]: eslintVersion({ version: request.version }),
        [`${consumerRepo({ name: request.name })}/${LINT_SCRIPT_PACKAGE_JSON}`]: lintScript({ command: request.lintCommand }),
      },
    }),
    fileRemoval: createDefaultFileRemovalPort({}),
    modules: pieceModulesOn({ line: request.line, base: modules }),
    path,
    eslint: await eslintPortOn({ line: request.line }),
    moduleExtension: ".ts",
  }).run({
    repoRoot: consumerRepo({ name: request.name }),
    installRoot: INSTALL_ROOT,
    declaredConfigRoots: [],
    files: [repoPathOf("packages/a/x.ts")],
    trackedPaths: [
      repoPathOf("packages/a/x.ts"),
      repoPathOf("package.json"),
      repoPathOf("packages/a/eslint.config.mjs"),
    ],
    clauses: [ESLINT_CLAUSE],
    records: request.records,
  });

const PACKAGE_HIT = { file: "packages/a/x.ts" };

const PACKAGE_LEGACY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLAUSE,
  mechanism: "eslint",
  file: repoPathOf("packages/a/legacy.ts"),
  reason: "Inherited class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const PACKAGE_CONFIG_REPO = { name: "monorepo-package-config", records: [PACKAGE_LEGACY_CARVE_OUT] };

const ROOT_CONFIG_REPO = { name: "monorepo-root-config", records: [] };

const NEAREST_LOOKUP_FLAG = "--flag v10_config_lookup_from_file";

const NEAREST_LOOKUP_TEAMS = [
  { version: "10.11.0", lintCommand: "eslint ." },
  { version: "9.39.5", lintCommand: `eslint ${NEAREST_LOOKUP_FLAG} .` },
];

describe.each(ESLINT_LINES)("the ESLint runner on %s follows the config lookup the team's own ESLint run uses, over a monorepo with a config per package", (line) => {
  it.each(NEAREST_LOOKUP_TEAMS)("applies a package config's projection under ESLint $version running `$lintCommand`", async (team) => {
    await expect(monorepoRun({ line, ...PACKAGE_CONFIG_REPO, ...team })).resolves.toMatchObject({
      outcome: "ok",
      value: { hits: [PACKAGE_HIT], projection: "current" },
    });
  });

  it("finds no projection in effect under ESLint 9 run from the root, which loads only the root config", async () => {
    await expect(
      monorepoRun({ line, ...PACKAGE_CONFIG_REPO, version: "9.39.5", lintCommand: "eslint ." }),
    ).resolves.toMatchObject({ outcome: "ok", value: { hits: [], projection: "not-included" } });
  });

  it.each(NEAREST_LOOKUP_TEAMS)("finds no projection in effect where a package config drops it under ESLint $version running `$lintCommand`", async (team) => {
    await expect(monorepoRun({ line, ...ROOT_CONFIG_REPO, ...team })).resolves.toMatchObject({
      outcome: "ok",
      value: { hits: [], projection: "not-included" },
    });
  });

  it("applies the root config's projection to every package under ESLint 9 run from the root", async () => {
    await expect(
      monorepoRun({ line, ...ROOT_CONFIG_REPO, version: "9.39.5", lintCommand: "eslint ." }),
    ).resolves.toMatchObject({ outcome: "ok", value: { hits: [PACKAGE_HIT], projection: "current" } });
  });
});

const PACKAGE_A = `${consumerRepo({ name: "monorepo-package-config" })}/packages/a`;

const lintedFromPackage = async (request: { readonly line: EslintLine; readonly file: string }) => {
  const Eslint = await eslintClassOn({ line: request.line });
  return new Eslint({ cwd: PACKAGE_A }).lintText("export class Inherited {}\n", { filePath: `${PACKAGE_A}/${request.file}` });
};

describe.each(ESLINT_LINES)("a package that spreads its own projection slice, on real %s", (line) => {
  it("lints from its own folder against its own config, honouring its carve-out", async () => {
    await expect(lintedFromPackage({ line, file: "legacy.ts" })).resolves.toMatchObject([{ messages: [] }]);
  });

  it("lints from its own folder against its own config, still flagging a file its carve-outs do not name", async () => {
    await expect(lintedFromPackage({ line, file: "fresh.ts" })).resolves.toMatchObject([
      { messages: [{ ruleId: "hone/no-class-authoring" }] },
    ]);
  });

  it.each(NEAREST_LOOKUP_TEAMS)(
    "is judged the same by the check from the root under ESLint $version running `$lintCommand`: slice current and applied, the uncarved file flagged",
    async (team) => {
      await expect(monorepoRun({ line, ...PACKAGE_CONFIG_REPO, ...team })).resolves.toMatchObject({
        outcome: "ok",
        value: { hits: [PACKAGE_HIT], projection: "current", slices: [], unprojectedFolders: [] },
      });
    },
  );

  it.each(NEAREST_LOOKUP_TEAMS)(
    "names the slice of a package whose config spreads no slice as missing and not applied under ESLint $version running `$lintCommand`",
    async (team) => {
      await expect(monorepoRun({ line, ...ROOT_CONFIG_REPO, ...team })).resolves.toMatchObject({
        outcome: "ok",
        value: {
          projection: "not-included",
          slices: [
            { slice: "packages/a/disciplines.eslint.mjs", state: "missing" },
            { slice: "packages/a/disciplines.eslint.mjs", state: "not-applied" },
          ],
        },
      });
    },
  );

  it("requires no slice for a package config ESLint 9 never loads, resolving every file from the root config", async () => {
    await expect(
      monorepoRun({ line, ...ROOT_CONFIG_REPO, version: "9.39.5", lintCommand: "eslint ." }),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current", slices: [], unprojectedFolders: [] } });
  });
});

import { afterAll, assert, describe, expect, it, vi } from "vitest";
import { createDefaultScratchFilesPort, type ListedEntry, type ScratchFilesPort } from "../../../../../../delivery/install-proof/install-proof-ports.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { Result } from "../../../../../domain/result.ts";
import { createExceptionRepository } from "../../../../discipline-exceptions-folder/exception-layout.ts";
import type { VersionOneWhyChain } from "../../../../discipline-exceptions-folder/version-one-why-chain.ts";
import { createSelectionRepository, type SelectionRepository } from "../../../../disciplines-file/consumer-selection.ts";
import type { EmbeddedRunner } from "../../../protocol/embedded/embedded-runner-module-schema.ts";
import { toolchainBoundEmbeddedRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import type { ModuleExtension } from "../../../../node/modules/install-layout.ts";
import { runCheck } from "../../../../../application/run/check/run-check.ts";
import { loadRunner } from "../../../protocol/engine-run/load-runner.ts";
import { checkConformance } from "../../../protocol/conformance.ts";
import type { ExceptionRecord, ExceptionRepository } from "../../../../discipline-exceptions-folder/exception-records.ts";
import type { LoadedRunner, RunnerClause } from "../../../protocol/runner-module/runner-module-schema.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { GitPort } from "../../../../git/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort, type PathPort } from "../../../../node/path-port.ts";
import { type ClauseDefinition, readDisciplineFile } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../../../../hone-config-file/assessment.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema, mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { runner as walkerRunner } from "../../../audit/runner/runner.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../embedded-runner/create-eslint-runner.ts";
import { eslint9PieceModules, eslint9ToolchainModules } from "../toolchain/eslint-9/eslint-9-engine.ts";
import {
  createEslintPort,
  type EslintClass,
  type EslintPort,
  type EslintToolchain,
} from "../toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "../toolchain/eslint-toolchain.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";

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

type ScratchRepositories = {
  readonly repositoryWith: (request: { readonly files: Readonly<Record<string, string>> }) => AbsolutePath;
  readonly removeAll: () => void;
};

const scratchRepositoriesUnder = (request: {
  readonly parent: string;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
}): ScratchRepositories => {
  const made: AbsolutePath[] = [];
  return {
    repositoryWith: (repository) => {
      const folder = absolutePathSchema.parse(`${request.parent.replaceAll("\\", "/")}/scratch-${globalThis.crypto.randomUUID()}`);
      const directory = request.scratch.makeDirectory({ path: folder });
      if (directory.outcome !== "ok") {
        throw new Error(`a scratch folder could not be made at ${folder}: ${directory.error.detail}`);
      }
      made.push(folder);
      Object.entries(repository.files).forEach(([name, text]) => {
        request.fileText.write({ path: `${folder}/${name}`, text });
      });
      return folder;
    },
    removeAll: () => {
      made.forEach((folder) => {
        request.scratch.removeTree({ path: folder });
      });
    },
  };
};

const SINGLE_FILE = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_FOLDER_NAME = "discipline-exceptions";

const singleFileRepositoryOver = (request: {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
}): ExceptionRepository =>
  createExceptionRepository({
    ...request,
    fileText: {
      ...request.fileText,
      exists: (query) => (query.path.endsWith(SPLIT_FOLDER_NAME) ? "absent" : request.fileText.exists(query)),
    },
    directory: {
      list: ({ path }) => ({ outcome: "failed", error: { kind: "directory-unreadable", path, detail: "the single-file fake holds no folders" } }),
      create: ({ path }) => ({ outcome: "failed", error: { kind: "directory-uncreatable", path, detail: "the single-file fake holds no folders" } }),
    },
    fileRemoval: { remove: ({ path }) => ({ outcome: "failed", error: { kind: "unremovable", path, detail: "the single-file fake removes nothing" } }) },
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [SINGLE_FILE] }) },
  });

type DiskRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
};

const withSingleFileRecords = <Request extends DiskRequest>(
  request: Request,
): Request & { readonly selectionRepository: SelectionRepository; readonly exceptionRepository: ExceptionRepository } => ({
  ...request,
  selectionRepository: createSelectionRepository(request),
  exceptionRepository: singleFileRepositoryOver(request),
});

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
  readonly scratch: ScratchFilesPort;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
};

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
  const made = request.scratch.makeDirectory({ path: `${request.repo}/${slashed({ path: request.entry.path })}` });
  if (made.outcome !== "ok") {
    failed({ what: `a fixture folder could not be made for ${request.entry.path}`, detail: made.error.detail });
  }
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
  if (request.entry.entryKind === "folder") {
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
  const made = request.scratch.makeDirectory({ path: request.path.directoryOf({ path: target }) });
  if (made.outcome !== "ok") {
    failed({ what: `a folder for the fixture text could not be made for ${request.file}`, detail: made.error.detail });
  }
  const written = request.fileText.write({ path: target, text: request.text });
  if (written.outcome !== "ok") {
    failed({ what: `a fixture text could not be written at ${target}`, detail: written.error.detail });
  }
};

const restoredOnce = (request: Dependencies & RestoredFixture): AbsolutePath => {
  const listed = request.scratch.listTree({ path: request.fixtureRoot });
  if (listed.outcome !== "ok") {
    return failed({ what: `the fixture at ${request.fixtureRoot} could not be listed`, detail: listed.error.detail });
  }
  const repo = request.repositories.repositoryWith({ files: {} });
  const folders = listed.value.filter(({ entryKind }) => entryKind === "folder");
  const files = listed.value.filter(({ entryKind }) => entryKind === "file");
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

const CLAUSE = clauseAddressSchema.parse("CD-14#class-syntax");

const CLASS_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const ESLINT_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/CD-14`,
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { pluginNamespace: "hone", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" },
};

const WALKER_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/audit/CD-14`,
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "class-syntax.ts" },
};

const fileText = createDefaultFileTextPort({});

const modules = createDefaultModuleLoaderPort({});

const path = createDefaultPathPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

const restoredFixtures = restoredFixtureRepositoriesOver({ repositories, scratch, fileText, path });

afterAll(() => {
  repositories.removeAll();
});

const consumerRepoWithText = (request: { readonly name: string; readonly textFiles: TextFiles }): AbsolutePath =>
  restoredFixtures.restoredFrom({ fixtureRoot: absolutePathSchema.parse(`${import.meta.dirname}/${request.name}`), textFiles: request.textFiles });

const consumerRepo = (request: { readonly name: string }): AbsolutePath => consumerRepoWithText({ name: request.name, textFiles: NO_TEXT_FILES });

const gitTracking = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const checkOver = (request: { readonly repoRoot: AbsolutePath; readonly tracked: readonly RepoPath[]; readonly line: EslintLine }) =>
  runCheck(withSingleFileRecords({
    repoRoot: request.repoRoot,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: DEFAULT_ASSESSMENT,
    fileText,
    modules: runnerModulesOn({ line: request.line, base: modules }),
    path,
    git: gitTracking({ tracked: request.tracked }),
  }));

const checkOf = (request: { readonly name: string; readonly tracked: readonly RepoPath[]; readonly line: EslintLine }) =>
  checkOver({ repoRoot: consumerRepo({ name: request.name }), tracked: request.tracked, line: request.line });

const classFinding = (request: { readonly file: string; readonly line: number }) => ({
  clause: CLASS_SYNTAX,
  file: request.file,
  anchor: { line: request.line, column: 7 },
  snippet: "export class Kept {}",
  mechanism: "eslint",
});

const NOT_RUN_NOT_INCLUDED = { kind: "mechanism-not-run", mechanism: "eslint", projection: "not-included", nestedConfigurations: [] };

describe.each(ESLINT_LINES)("real %s config resolution behind the ESLint runner's query instance, over a consumer repository", (line) => {
  it("reports an unrecorded override block placed after the projection as a config-override", async () => {
    await expect(checkOf({ name: "override-after", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unrecorded: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts", mechanism: "eslint" }],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });

  it("reports an unrecorded global ignore over a file holding a class, and core still finds the class", async () => {
    await expect(checkOf({ name: "global-ignore", tracked: [repoPathSchema.parse("gen/g.ts"), repoPathSchema.parse("src/clean.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "gen/g.ts", line: 1 })],
        unrecorded: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "gen/g.ts", mechanism: "eslint" }],
        unmeasured: [],
      },
    });
  });

  it("reports a rule the team sets to severity 0 everywhere with no records as config-overrides, the projection still in effect", async () => {
    await expect(checkOf({ name: "severity-zero", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unrecorded: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts", mechanism: "eslint" }],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });

  it("lists mechanism-not-run not-included when a later team block sets a recorded file back to error", async () => {
    await expect(checkOf({ name: "re-enabled-record", tracked: [repoPathSchema.parse("src/owned.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });
});

describe.each(ESLINT_LINES)("eslint-suppressions.json files and package.json lint scripts read by the ESLint runner on %s, over a consumer repository", (line) => {
  it("reports an entry in the default eslint-suppressions.json as a suppression-entry", async () => {
    await expect(
      checkOf({ name: "suppression-default", tracked: [repoPathSchema.parse("supp/a.ts"), repoPathSchema.parse("eslint-suppressions.json")], line }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "supp/a.ts", line: 1 })],
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/a.ts",
            location: "eslint-suppressions.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports entries in suppressions files a package.json script names in space and equals form, a dormant one included", async () => {
    await expect(
      checkOf({
        line,
        name: "suppression-scripted",
        tracked: [
          repoPathSchema.parse("supp/b.ts"),
          repoPathSchema.parse("supp/clean.ts"),
          repoPathSchema.parse("package.json"),
          repoPathSchema.parse("custom/supp.json"),
          repoPathSchema.parse("custom/supp2.json"),
        ],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "supp/b.ts", line: 1 })],
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/b.ts",
            location: "custom/supp.json",
            mechanism: "eslint",
          },
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/clean.ts",
            location: "custom/supp2.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports an entry in a nested tracked eslint-suppressions.json against its own directory", async () => {
    await expect(
      checkOf({
        line,
        name: "suppression-nested",
        tracked: [repoPathSchema.parse("packages/a/src/n.ts"), repoPathSchema.parse("packages/a/eslint-suppressions.json")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "packages/a/src/n.ts",
            location: "packages/a/eslint-suppressions.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports each command-line option that weakens the run, and neither one that changes nothing ESLint already does nor a rule id that merely extends the selected one", async () => {
    await expect(
      checkOf({
        line,
        name: "command-line-options",
        tracked: [repoPathSchema.parse("src/plain.ts"), repoPathSchema.parse("package.json")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [],
        unrecorded: [
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "--rule hone/no-class-authoring: off",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "-c alt.config.mjs",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:suppress",
            option: "--suppress-all",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:suppress",
            option: "--suppress-rule hone/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:hidden",
            option: "--ignore-pattern src/**",
            mechanism: "eslint",
          },
        ],
      },
    });
  });
});

const INLINE_FORM_FILES: readonly RepoPath[] = [
  repoPathSchema.parse("i/disable-file.ts"),
  repoPathSchema.parse("i/disable-file-named.ts"),
  repoPathSchema.parse("i/disable-line.ts"),
  repoPathSchema.parse("i/disable-next-line.ts"),
  repoPathSchema.parse("i/rule-config.ts"),
  repoPathSchema.parse("i/other-rule.ts"),
  repoPathSchema.parse("i/enable.ts"),
  repoPathSchema.parse("i/global.ts"),
];

const INLINE_FORM_TEXTS: TextFiles = {
  "i/disable-file-named.ts": "/* eslint-disable hone/no-class-authoring */\nexport class Kept {}\n",
  "i/disable-line.ts": "export const plain = 1;\nexport class Kept {} // eslint-disable-line hone/no-class-authoring\n",
  "i/disable-next-line.ts": "// eslint-disable-next-line hone/no-class-authoring\nexport class Kept {}\n",
  "i/rule-config.ts": '/* eslint hone/no-class-authoring: "off" */\nexport class Kept {}\n',
};

const inlineFormsCheckOf = (request: { readonly line: EslintLine }) =>
  checkOver({ repoRoot: consumerRepoWithText({ name: "inline-forms", textFiles: INLINE_FORM_TEXTS }), tracked: INLINE_FORM_FILES, line: request.line });

describe.each(ESLINT_LINES)("inline configuration comments read by the ESLint runner's governance rule on real %s, over a consumer repository", (line) => {
  it("reports each disable and rule-config form naming the selected rule and none of the rest", async () => {
    await expect(inlineFormsCheckOf({ line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        unrecorded: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-file.ts",
            line: 1,
            text: "/* eslint-disable */",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-file-named.ts",
            line: 1,
            text: "/* eslint-disable hone/no-class-authoring */",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            line: 2,
            text: "// eslint-disable-line hone/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-next-line.ts",
            line: 1,
            text: "// eslint-disable-next-line hone/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "inline-rule-config",
            clause: CLASS_SYNTAX,
            file: "i/rule-config.ts",
            line: 1,
            text: '/* eslint hone/no-class-authoring: "off" */',
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("still finds the class in every file whatever its inline comment says", async () => {
    await expect(inlineFormsCheckOf({ line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [
          classFinding({ file: "i/disable-file.ts", line: 2 }),
          classFinding({ file: "i/disable-file-named.ts", line: 2 }),
          {
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            anchor: { line: 2, column: 7 },
            snippet: "export class Kept {} // eslint-disable-line hone/no-class-authoring",
            mechanism: "eslint",
          },
          classFinding({ file: "i/disable-next-line.ts", line: 2 }),
          classFinding({ file: "i/rule-config.ts", line: 2 }),
          classFinding({ file: "i/other-rule.ts", line: 2 }),
          classFinding({ file: "i/enable.ts", line: 2 }),
          classFinding({ file: "i/global.ts", line: 2 }),
        ],
      },
    });
  });
});

describe.each(ESLINT_LINES)("real %s glob matching of the generated projection's record blocks, over a consumer repository", (line) => {
  it("exempts route/[id].ts by its authorised location and still finds the class in route/i.ts", async () => {
    await expect(
      checkOf({ name: "route-brackets", tracked: [repoPathSchema.parse("route/[id].ts"), repoPathSchema.parse("route/i.ts")], line }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "route/i.ts", line: 1 })],
        exempted: [
          {
            finding: classFinding({ file: "route/[id].ts", line: 1 }),
            by: [{ kind: "authorised-location", file: "route/[id].ts" }],
          },
        ],
        unrecorded: [],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });
});

describe.each(ESLINT_LINES)("the ESLint runner's projection states under real %s, over a consumer repository", (line) => {
  it("lists mechanism-not-run missing when the projection was never generated", async () => {
    await expect(checkOf({ name: "projection-missing", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unmeasured: [{ kind: "mechanism-not-run", mechanism: "eslint", projection: "missing" }] },
    });
  });

  it("lists the projection out-of-date when it was hand-edited", async () => {
    await expect(checkOf({ name: "projection-hand-edited", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unmeasured: [],
        projectionProblems: [{ mechanism: "eslint", state: "out-of-date" }],
      },
    });
  });

  it("lists mechanism-not-run not-included when the team config does not import the projection", async () => {
    await expect(checkOf({ name: "projection-not-imported", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });

  it("lists mechanism-not-run not-included when the piece's fragment is imported instead of the projection beside an authorised location", async () => {
    await expect(
      checkOf({
        line,
        name: "fragment-not-projection",
        tracked: [repoPathSchema.parse("src/owned.ts"), repoPathSchema.parse("src/clean.ts")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });
});

const SHARED_CASE_FILES: readonly RepoPath[] = [
  repoPathSchema.parse("src/decl.ts"),
  repoPathSchema.parse("src/expr.ts"),
  repoPathSchema.parse("src/default.ts"),
  repoPathSchema.parse("src/abstract.ts"),
  repoPathSchema.parse("src/nested.ts"),
  repoPathSchema.parse("src/space.ts"),
  repoPathSchema.parse("src/anon.ts"),
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
  const loaded = readDisciplineFile({ fileText, path, ruleSetRoot: INSTALL_ROOT, discipline: disciplineIdSchema.parse("CD-14") });
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
  const loaded = await loadRunner({
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    modules: runnerModulesOn({ line: request.line, base: modules }),
    path,
    mechanism: mechanismIdSchema.parse("eslint"),
  });
  assert(loaded.outcome === "ok", "core loads the ESLint runner module");
  return loaded.value;
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
    files: [repoPathSchema.parse("packages/a/x.ts")],
    trackedPaths: [
      repoPathSchema.parse("packages/a/x.ts"),
      repoPathSchema.parse("package.json"),
      repoPathSchema.parse("packages/a/eslint.config.mjs"),
    ],
    clauses: [ESLINT_CLAUSE],
    records: request.records,
  });

const PACKAGE_HIT = { file: "packages/a/x.ts" };

const PACKAGE_LEGACY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLAUSE,
  mechanism: mechanismIdSchema.parse("eslint"),
  file: repoPathSchema.parse("packages/a/legacy.ts"),
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

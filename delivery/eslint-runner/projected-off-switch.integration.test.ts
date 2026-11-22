import { afterAll, assert, describe, expect, it } from "vitest";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import type { ModuleLoaderPort } from "../../src/application/ports/host/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import { createDefaultScratchFilesPort, type ListedEntry, type ScratchFilesPort } from "../install-proof/install-proof-ports.ts";
import type { RunnerFailure } from "../../src/domain/runner/runner-failure.ts";
import type { Result } from "../../src/domain/result.ts";
import type { ExceptionRecord } from "../../src/domain/records/discipline-exceptions/exception-record.ts";
import type { EmbeddedRunner } from "../../src/infrastructure/engines/protocol/embedded/embedded-runner-module-schema.ts";
import type { RunnerClause } from "../../src/domain/runner/runner-module-types.ts";
import { toolchainBoundEmbeddedRunner } from "../../src/infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../../src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import { eslint9PieceModules, eslint9ToolchainModules } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import { createEslintPort, type EslintToolchain } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../../src/domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../src/domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../src/domain/rule-set/clause-address.ts";
import { editionOf } from "../../src/domain/rule-set/edition-of.ts";

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly pieceModules: (request: { readonly base: ModuleLoaderPort }) => ModuleLoaderPort;
};

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../..`, installForm: "source" });

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

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../..`);

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

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

const restoredFixtures = restoredFixtureRepositoriesOver({ repositories, scratch, fileText, path: createDefaultPathPort({}) });

afterAll(() => {
  repositories.removeAll();
});

const ROUTE_FILES = [repoPathOf("route/[id].ts"), repoPathOf("route/i.ts")];

const ROUTE_RUN = {
  repoRoot: restoredFixtures.restoredFrom({ fixtureRoot: absolutePathSchema.parse(`${import.meta.dirname}/../../src/infrastructure/engines/eslint/runner/native-exceptions/route-brackets`), textFiles: NO_TEXT_FILES }),
  installRoot: INSTALL_ROOT,
  declaredConfigRoots: [],
  files: ROUTE_FILES,
  trackedPaths: ROUTE_FILES,
  clauses: [ESLINT_CLAUSE],
};

const ROUTE_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLAUSE,
  mechanism: "eslint",
  file: repoPathOf("route/[id].ts"),
  reason: "wrapping factory for a library construction",
};

describe.each(ESLINT_LINES)("real %s config resolution of the projection's own off-switch, over a consumer repository", (line) => {
  it("reports no config-override on the file a record projects off", async () => {
    await expect(eslintRunnerOn({ line }).run({ ...ROUTE_RUN, records: [ROUTE_LOCATION] })).resolves.toMatchObject({
      outcome: "ok",
      value: { nativeExceptions: [], projection: "current" },
    });
  });

  it("reports the same off-switch as a config-override once no record holds the file", async () => {
    await expect(eslintRunnerOn({ line }).run({ ...ROUTE_RUN, records: [] })).resolves.toMatchObject({
      outcome: "ok",
      value: { nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "route/[id].ts" }] },
    });
  });
});

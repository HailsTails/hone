import { afterAll, assert, describe, expect, it, vi } from "vitest";
import { createDefaultScratchFilesPort, type ListedEntry, type ScratchFilesPort } from "../../../../delivery/install-proof/install-proof-ports.ts";
import { runCheck } from "./run-check.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { Result } from "../../../domain/result.ts";
import { checkCommandOutcome } from "../../../infrastructure/command-line/outcomes/check-command-outcome.ts";
import type { LoadFailure } from "../../../infrastructure/command-line/load-failure.ts";
import { createExceptionRepository } from "../../../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import type { ExceptionRepository } from "../../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository, type SelectionRepository } from "../../../infrastructure/disciplines-file/consumer-selection.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../../../infrastructure/git/git-port.ts";
import type { ModuleExtension } from "../../../infrastructure/node/modules/install-layout.ts";
import { createDefaultModuleLoaderPort } from "../../../infrastructure/node/modules/module-loader-port.ts";
import type { ExitCode } from "../../../infrastructure/node/process/process-port.ts";
import { createDefaultPathPort, type PathPort } from "../../../infrastructure/node/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../../../infrastructure/hone-config-file/assessment.ts";
import { type RepoPath, repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";

const SINGLE_FILE_RECORDS = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_FOLDER_NAME = "discipline-exceptions";

type DiskRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
};

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
      list: ({ path: folder }) => ({ outcome: "failed", error: { kind: "directory-unreadable", path: folder, detail: "the single-file fake holds no folders" } }),
      create: ({ path: folder }) => ({ outcome: "failed", error: { kind: "directory-uncreatable", path: folder, detail: "the single-file fake holds no folders" } }),
    },
    fileRemoval: { remove: ({ path: file }) => ({ outcome: "failed", error: { kind: "unremovable", path: file, detail: "the single-file fake removes nothing" } }) },
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [SINGLE_FILE_RECORDS] }) },
  });

const withSingleFileRecords = <Request extends DiskRequest>(
  request: Request,
): Request & { readonly selectionRepository: SelectionRepository; readonly exceptionRepository: ExceptionRepository } => ({
  ...request,
  selectionRepository: createSelectionRepository(request),
  exceptionRepository: singleFileRepositoryOver(request),
});

const PROJECT_COMMAND = "node src/hone.ts project --repo .";

const PRUNE_COMMAND = "node src/hone.ts prune-debt --repo .";

const fullReportExitCode = (request: { readonly checked: Result<CheckReport, LoadFailure> }): ExitCode =>
  checkCommandOutcome({
    result:
      request.checked.outcome === "failed"
        ? request.checked
        : { outcome: "ok", value: { report: request.checked.value, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } },
  }).code;

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

const OUTSIDE_THE_ROOT = "..";

const OUTSIDE_THE_ROOT_PREFIX = `${OUTSIDE_THE_ROOT}/`;

type RehomedImports = {
  readonly text: string;
  readonly path: Pick<PathPort, "join" | "relative">;
  readonly fixtureRoot: string;
  readonly from: string;
  readonly to: string;
};

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

type FixtureDependencies = {
  readonly repositories: ScratchRepositories;
  readonly scratch: ScratchFilesPort;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
};

type EntryRequest = FixtureDependencies & {
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

const restoredFixture = (request: FixtureDependencies & { readonly fixtureRoot: AbsolutePath }): AbsolutePath => {
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
  const resolved = request.path.resolve({ path: repo });
  return resolved.outcome === "ok" ? resolved.value : failed({ what: `the restored repository at ${repo} has no absolute path`, detail: resolved.error.path });
};

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const git: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [
      repoPathSchema.parse("discipline-exceptions.json"),
      repoPathSchema.parse("disciplines.json"),
      repoPathSchema.parse("src/fresh.ts"),
      repoPathSchema.parse("src/parse.ts"),
    ],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

describe("the shipped CD-1 rule, read from rules/CD-1/discipline.json through a full check (CD-47: the shipped rule file is the assertion's subject; nothing is spawned or written)", () => {
  it("accepts an authorised location for CD-1 and still flags an unrecorded any cast", async () => {
    const report = await runCheck(withSingleFileRecords({
      repoRoot: resolvedPath({ path: `${import.meta.dirname}/cd1-exempted` }),
      installRoot: resolvedPath({ path: `${import.meta.dirname}/../../../..` }),
      moduleExtension: ".ts",
      baseRevision: undefined,
      assessment: DEFAULT_ASSESSMENT,
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path,
      git,
    }));
    expect(report).toMatchObject({
      outcome: "ok",
      value: {
        invalidRecords: [],
        findings: [{ clause: { discipline: "CD-1", clause: "any-cast" }, file: "src/fresh.ts" }],
        exempted: [{ finding: { file: "src/parse.ts" }, by: [{ kind: "authorised-location" }] }],
      },
    });
  });
});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: resolvedPath({ path: `${import.meta.dirname}/../../../../artefacts` }), fileText: createDefaultFileTextPort({}), scratch });

afterAll(() => {
  repositories.removeAll();
});

const CASCADE_REPO = restoredFixture({
  repositories,
  scratch,
  fileText: createDefaultFileTextPort({}),
  path,
  fixtureRoot: resolvedPath({ path: `${import.meta.dirname}/cd1-cascade` }),
});

const LEGACY_FILE = repoPathSchema.parse("src/legacy.ts");

const cascadeCheck = (request: { readonly changed: readonly RepoPath[] }) => {
  const cascadeGit: GitPort = {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
      outcome: "ok",
      value: [
        repoPathSchema.parse("discipline-exceptions.json"),
        repoPathSchema.parse("disciplines.json"),
        LEGACY_FILE,
      ],
    }),
    changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: request.changed }),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  };
  return runCheck(withSingleFileRecords({
    repoRoot: CASCADE_REPO,
    installRoot: resolvedPath({ path: `${import.meta.dirname}/../../../..` }),
    moduleExtension: ".ts",
    baseRevision: "origin/main",
    assessment: DEFAULT_ASSESSMENT,
    fileText: createDefaultFileTextPort({}),
    modules: createDefaultModuleLoaderPort({}),
    path,
    git: cascadeGit,
  }));
};

describe("adopting a repository whose legacy file holds CD-1 debt beside another discipline's debt (CD-47: the shipped rules and the fixture's own files are the assertion's subject; nothing is spawned or written)", () => {
  it("passes with the file untouched and every carve-out, the CD-1 ones included, still in force", async () => {
    const cascadeReport = await cascadeCheck({ changed: [] });
    expect(cascadeReport).toMatchObject({
      outcome: "ok",
      value: {
        findings: [],
        invalidRecords: [],
        forfeited: [],
        exempted: expect.arrayContaining([
          expect.objectContaining({ finding: expect.objectContaining({ clause: { ruleSet: "hone", discipline: "CD-1", clause: "any-cast" } }) }),
          expect.objectContaining({ finding: expect.objectContaining({ clause: { ruleSet: "hone", discipline: "CD-1", clause: "explicit-any" } }) }),
          expect.objectContaining({ finding: expect.objectContaining({ clause: { ruleSet: "hone", discipline: "CD-15", clause: "loops" } }) }),
        ]),
      },
    });
    expect(fullReportExitCode({ checked: cascadeReport })).toBe(0);
  });

  it("forfeits all three carve-outs once the file is touched, the ordinary touch-and-own for any discipline", async () => {
    const cascadeReport = await cascadeCheck({ changed: [LEGACY_FILE] });
    expect(cascadeReport).toMatchObject({ outcome: "ok", value: { forfeited: [{}, {}, {}] } });
    expect(fullReportExitCode({ checked: cascadeReport })).toBe(1);
  });
});

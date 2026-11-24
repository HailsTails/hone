import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import type { SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { commandOf } from "./composed-command.ts";
import {
  alreadyUpgradedCommand,
  createFoundTreeReach,
  UPGRADE,
  type UpgradeCommandPorts,
} from "./upgrade-command.ts";

const SELECTION = '{ "version": 1, "ruleSets": {}, "clauses": { "CD-15#loops": "walker" } }';

const PORTS = {
  gitTree: { pathsAt: vi.fn() },
  directory: { list: vi.fn(), create: vi.fn() },
  recordsSourceOf: vi.fn(),
  stagesOver: vi.fn(),
  childMeasuredStagesOver: vi.fn(),
  fileCreation: { createNew: vi.fn() },
  fileRemoval: { remove: vi.fn() },
  directoryRemoval: { removeEmpty: vi.fn() },
  entryKind: { kindOf: vi.fn() },
  foundTreeRecordsSourceOf: vi.fn(),
  loadFailureDetail: vi.fn(),
  recordsReader: { recordsReadingOf: vi.fn() },
  recordsEditor: {
    documentsWithAdded: vi.fn(),
    placeOfAddition: vi.fn(),
    documentsWithRepointed: vi.fn(),
    documentsWithRemoved: vi.fn(),
  },
  boundCatalogueOf: vi.fn(),
  settingsFormat: { fileOf: vi.fn(), documentOf: vi.fn(), textOf: vi.fn() },
  settingsSourcesOf: vi.fn(),
  checkPieceSourceOf: vi.fn(),
  namedEngine: { load: vi.fn(), run: vi.fn(), project: vi.fn() },
  versionOneProjectionOf: vi.fn(),
  measureVersionOne: vi.fn(),
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [],
  engines: [],
  symptoms: [],
  clauses: [],
  namedBans: [],
  checks: [],
};

const GIT_FAILED = {
  outcome: "failed",
  error: { kind: "git-failed", command: "git ls-files", detail: "not a git repository" },
} as const;

const commandWith = (request: {
  readonly arguments: readonly string[];
  readonly git: GitPort;
}): VersionOneCommandRequest => ({
  process: {
    arguments: request.arguments,
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: SELECTION }),
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
    write: vi.fn<FileTextPort["write"]>(),
  },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: request.git,
  exceptionRepositoryOf: vi.fn(),
  exceptionEntryParser: {
    parseExceptionEntries: vi.fn(),
    importedEntriesIn: vi.fn(),
    importSourcesOf: vi.fn(),
  },
  selectionRepositoryOf: vi.fn(),
  shownPathOfRepository: vi.fn(),
  moduleUrl: "file:///install/src/hone.ts",
});

const gitListing = (listed: ReturnType<GitPort["trackedPaths"]>): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue(listed),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

describe("the upgrade command", () => {
  it("exits 2 with an arguments-invalid line, reading nothing, when --repo is not given", async () => {
    const command = commandWith({ arguments: [], git: gitListing(GIT_FAILED) });
    const upgrade = commandOf({ tool: UPGRADE, ports: { ...command, ...PORTS } });
    await upgrade(command);
    expect(vi.mocked(command.process.writeOut).mock.calls).toEqual([
      [
        {
          text: "load failure: arguments-invalid hone upgrade needs --repo <dir>: the folder that holds disciplines.json, usually the repository root\n",
        },
      ],
    ]);
    expect(vi.mocked(command.process.exitWith).mock.calls).toEqual([[{ code: 2 }]]);
  });

  it("exits 2 with a git-failed line when the tracked files cannot be listed", async () => {
    const command = commandWith({ arguments: ["--repo", "/repo"], git: gitListing(GIT_FAILED) });
    const upgrade = commandOf({ tool: UPGRADE, ports: { ...command, ...PORTS } });
    await upgrade(command);
    expect(vi.mocked(command.process.writeOut).mock.calls).toEqual([
      [{ text: "load failure: git-failed git ls-files: not a git repository\n" }],
    ]);
    expect(vi.mocked(command.process.exitWith).mock.calls).toEqual([[{ code: 2 }]]);
  });
});

describe("alreadyUpgradedCommand", () => {
  it("says the repository is already on version 2 and exits 0", async () => {
    const command = commandWith({ arguments: ["--repo", "/repo"], git: gitListing(GIT_FAILED) });

    await alreadyUpgradedCommand(command);

    expect({
      writes: vi.mocked(command.process.writeOut).mock.calls,
      exits: vi.mocked(command.process.exitWith).mock.calls,
    }).toEqual({
      writes: [[{ text: "already on version 2; nothing to upgrade\n" }]],
      exits: [[{ code: 0 }]],
    });
  });
});

describe("createFoundTreeReach", () => {
  it("measures in a child process, over git that counts the files the upgrade wrote as tracked and not those it removes", () => {
    const command = commandWith({
      arguments: [],
      git: gitListing({ outcome: "ok", value: [repoPathOf("src/a.ts")] }),
    });
    const childMeasuredStagesOver = vi.fn<UpgradeCommandPorts["childMeasuredStagesOver"]>();

    createFoundTreeReach({
      ports: { ...command, ...PORTS, childMeasuredStagesOver },
      command,
      located: { repoRoot: absoluteRootOf("/repo"), installRoot: absoluteRootOf("/install") },
      written: [repoPathOf("hone.eslint.d.mts")],
      removed: [repoPathOf("src/a.ts")],
    });

    const [[handed]] = childMeasuredStagesOver.mock.calls;
    expect(handed.ports.git.trackedPaths({ repoRoot: absoluteRootOf("/repo") })).toEqual({
      outcome: "ok",
      value: [repoPathOf("hone.eslint.d.mts")],
    });
  });

  it("reads records through the found tree's records source, over git that reads the base from the tree the upgrade found", () => {
    const command = commandWith({
      arguments: [],
      git: gitListing({ outcome: "ok", value: [repoPathOf("src/a.ts")] }),
    });
    const foundSource = vi.fn<UpgradeCommandPorts["recordsSourceOf"]>();
    const foundTreeRecordsSourceOf = vi
      .fn<UpgradeCommandPorts["foundTreeRecordsSourceOf"]>()
      .mockReturnValue(foundSource);
    const reach = createFoundTreeReach({
      ports: { ...command, ...PORTS, foundTreeRecordsSourceOf },
      command,
      located: { repoRoot: absoluteRootOf("/repo"), installRoot: absoluteRootOf("/install") },
      written: [repoPathOf("hone-records/debt/loop-keyword.json")],
      removed: [],
    });

    reach.recordsSourceFor({ catalogue: CATALOGUE });

    const [[handed]] = foundSource.mock.calls;
    expect({
      repoRoot: handed.repoRoot,
      catalogue: handed.catalogue,
      textInBase: handed.git.textInBase({
        repoRoot: absoluteRootOf("/repo"),
        baseRevision: "the tree the upgrade found",
        file: repoPathOf("hone-records/debt/loop-keyword.json"),
      }),
    }).toEqual({
      repoRoot: absoluteRootOf("/repo"),
      catalogue: CATALOGUE,
      textInBase: { outcome: "ok", value: { presence: "absent-from-base" } },
    });
  });
});

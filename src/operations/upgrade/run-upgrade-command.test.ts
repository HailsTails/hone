import { describe, expect, it, vi } from "vitest";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import type { GitPort } from "../../application/ports/git-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../../application/ports/host/process-port.ts";
import { alreadyUpgradedCommand, type UpgradePorts, upgradeCommandOf } from "./run-upgrade-command.ts";
import { createDefaultEnginePort } from "../../infrastructure/engines/protocol/engine-port.ts";

const notUsed = (): never => {
  throw new Error("this port is not used by the command under test");
};

const memoryFileTextOf = (request: { readonly files: Readonly<Record<string, string>> }): FileTextPort => {
  const held = new Map<string, string>(Object.entries(request.files).map(([file, text]) => [`/repo/${file}`, text]));
  const holdsUnder = (path: string): boolean => [...held.keys()].some((key) => key.startsWith(`${path}/`));
  return {
    exists: ({ path }) => (held.has(path) || holdsUnder(path) ? "present" : "absent"),
    read: ({ path }) => {
      const text = held.get(path);
      return text === undefined ? { outcome: "failed", error: { kind: "unreadable", path, detail: "absent" } } : { outcome: "ok", value: text };
    },
    write: ({ path, text }) => {
      held.set(path, text);
      return { outcome: "ok", value: undefined };
    },
  };
};

type Writes = Parameters<ProcessPort["writeOut"]>[];

type Exits = Parameters<ProcessPort["exitWith"]>[];

const recordedProcessWith = (request: { readonly arguments: readonly string[] }) => {
  const writes: Writes = [];
  const exits: Exits = [];
  const port: ProcessPort = {
    arguments: request.arguments,
    writeOut: (written) => writes.push([written]),
    writeError: () => undefined,
    exitWith: (exit) => exits.push([exit]),
  };
  return { port, writes, exits };
};

const commandOver = (request: { readonly process: ProcessPort; readonly fileText: FileTextPort }): VersionOneCommandRequest => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: request.fileText,
  engine: createDefaultEnginePort({}),
  modules: { load: notUsed },
  git: { trackedPaths: notUsed, changedSince: notUsed, contentInBase: notUsed, textInBase: notUsed, renamedSince: notUsed },
  exceptionRepositoryOf: notUsed,
  exceptionEntryParser: { parseExceptionEntries: notUsed, importedEntriesIn: notUsed, importSourcesOf: notUsed },
  selectionRepositoryOf: notUsed,
  shownPathOfRepository: notUsed,
  moduleUrl: "file:///install/src/hone.ts",
});

const PORTS: UpgradePorts = {
  gitTree: { pathsAt: vi.fn() },
  directory: { list: vi.fn(), create: vi.fn() },
  recordsSourceOf: vi.fn(),
  stagesOver: vi.fn(),
  fileCreation: { createNew: vi.fn() },
  fileRemoval: { remove: vi.fn() },
  directoryRemoval: { removeEmpty: vi.fn() },
  entryKind: { kindOf: vi.fn() },
  foundTreeRecordsSourceOf: vi.fn(),
  loadFailureDetail: vi.fn(),
  recordsReader: { recordsReadingOf: vi.fn() },
  symptomCatalogueOf: vi.fn(),
  settingsFormat: { fileOf: vi.fn(), documentOf: vi.fn(), textOf: vi.fn() },
  settingsSourcesOf: vi.fn(),
};

const gitFailing = (): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a git repository" } }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const commandWith = (request: { readonly arguments: readonly string[]; readonly files: Readonly<Record<string, string>>; readonly git: GitPort }) => {
  const recorded = recordedProcessWith({ arguments: request.arguments });
  const base = commandOver({ process: recorded.port, fileText: memoryFileTextOf({ files: request.files }) });
  const command: VersionOneCommandRequest = { ...base, git: request.git, exceptionRepositoryOf: vi.fn(), shownPathOfRepository: vi.fn() };
  return { command, recorded };
};

const SELECTION = '{ "version": 1, "ruleSets": {}, "clauses": { "CD-15#loops": "audit" } }';

describe("upgradeCommandOf", () => {
  it("exits 2 with an arguments-invalid line, reading nothing, when --repo is not given", async () => {
    const { command, recorded } = commandWith({ arguments: [], files: {}, git: gitFailing() });
    await upgradeCommandOf(PORTS)(command);
    expect({ writes: recorded.writes, exits: recorded.exits }).toEqual({
      writes: [[{ text: "load failure: arguments-invalid hone upgrade needs --repo <dir>: the folder that holds disciplines.json, usually the repository root\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with a git-failed line when the tracked files cannot be listed", async () => {
    const { command, recorded } = commandWith({ arguments: ["--repo", "/repo"], files: { "disciplines.json": SELECTION }, git: gitFailing() });
    await upgradeCommandOf(PORTS)(command);
    expect({ writes: recorded.writes, exits: recorded.exits }).toEqual({
      writes: [[{ text: "load failure: git-failed git ls-files: not a git repository\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

describe("alreadyUpgradedCommand", () => {
  it("says the repository is already on version 2 and exits 0", async () => {
    const { command, recorded } = commandWith({ arguments: ["--repo", "/repo"], files: {}, git: gitFailing() });
    await alreadyUpgradedCommand(command);
    expect({ writes: recorded.writes, exits: recorded.exits }).toEqual({
      writes: [[{ text: "already on version 2; nothing to upgrade\n" }]],
      exits: [[{ code: 0 }]],
    });
  });
});

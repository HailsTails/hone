import { describe, expect, it, vi } from "vitest";
import { commandOver, memoryRepositoryOf, recordedProcessWith } from "../../../tests/command-harness.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import type { GitPort } from "../../infrastructure/git/git-port.ts";
import { alreadyUpgradedCommand, type UpgradePorts, upgradeCommandOf } from "./run-upgrade-command.ts";

const PORTS: UpgradePorts = {
  gitTree: { pathsAt: vi.fn() },
  directory: { list: vi.fn(), create: vi.fn() },
  recordsSourceOf: vi.fn(),
  stagesOver: vi.fn(),
  fileCreation: { createNew: vi.fn() },
  fileRemoval: { remove: vi.fn() },
  directoryRemoval: { removeEmpty: vi.fn() },
  entryKind: { kindOf: vi.fn() },
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
  const base = commandOver({ process: recorded.port, fileText: memoryRepositoryOf({ files: request.files }).fileText });
  const command: VersionOneCommandRequest = { ...base, git: request.git, exceptionRepositoryOf: vi.fn() };
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

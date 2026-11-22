import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../../application/ports/git-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type {
  RecordsOnDiskOf,
  VersionOneReadOf,
} from "../../application/ports/records/version-one-reading.ts";
import type { RunSettingsOf } from "../../application/ports/selection/selection-repository.ts";
import type { ProofCarriedOver } from "../../application/ports/upgrade/proof-outcome.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { type UpgradeInput, type UpgradePorts, upgradeOf } from "./run-upgrade-command.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const SELECTION_ABSENT: LoadFailure = { kind: "selection-absent", repo: "/repo" };

const SETTINGS_READ = vi.fn<RunSettingsOf>().mockReturnValue({
  outcome: "ok",
  value: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
});

const gitListing = (request: {
  readonly tracked: ReturnType<GitPort["trackedPaths"]>;
}): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue(request.tracked),
  changedSince: vi.fn(),
  contentInBase: vi.fn(),
  textInBase: vi.fn(),
  renamedSince: vi.fn(),
});

const commandOver = (request: { readonly git: GitPort }): VersionOneCommandPorts => ({
  path: {
    join: vi.fn(),
    joinRepository: vi.fn(),
    relative: vi.fn(),
    directoryOf: vi.fn(),
    repositoryDirectoryOf: vi.fn(),
    resolve: vi.fn(),
    fromFileUrl: vi.fn(),
  },
  fileText: { read: vi.fn(), exists: vi.fn(), write: vi.fn() },
  modules: { load: vi.fn() },
  engine: {
    load: vi.fn(),
    run: { checks: vi.fn(), withRecords: vi.fn() },
    project: { checks: vi.fn(), withRecords: vi.fn() },
    conform: vi.fn(),
  },
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

const PORTS: UpgradePorts = {
  recordsReader: { recordsReadingOf: vi.fn() },
  boundCatalogueOf: vi.fn(),
  settingsFormat: { fileOf: vi.fn(), documentOf: vi.fn(), textOf: vi.fn() },
  settingsSourcesOf: vi.fn(),
  directory: { list: vi.fn(), create: vi.fn() },
  fileCreation: { createNew: vi.fn() },
  fileRemoval: { remove: vi.fn() },
  directoryRemoval: { removeEmpty: vi.fn() },
  entryKind: { kindOf: vi.fn() },
  loadFailureDetail: vi.fn(),
};

const inputWith = (request: Partial<UpgradeInput> & { readonly git: GitPort }): UpgradeInput => ({
  command: commandOver({ git: request.git }),
  ports: PORTS,
  located: { repoRoot: REPO_ROOT, installRoot: absoluteRootOf("/install") },
  runSettingsOf: SETTINGS_READ,
  catalogues: () => ({ outcome: "ok", value: [] }),
  recordsOnDiskOf: vi.fn<RecordsOnDiskOf>(),
  versionOneReadOf: vi.fn<VersionOneReadOf>(),
  proofRunsOf: vi.fn(),
  proofOf: vi.fn(),
  foundTreeStages: vi.fn(),
  ...request,
});

const TRACKED: ReturnType<GitPort["trackedPaths"]> = { outcome: "ok", value: [] };

describe("upgradeOf", () => {
  it("stops on the run settings' load failure and lists no tracked files", async () => {
    const git = gitListing({ tracked: TRACKED });

    expect(
      await upgradeOf(
        inputWith({
          git,
          runSettingsOf: vi
            .fn<RunSettingsOf>()
            .mockReturnValue({ outcome: "failed", error: SELECTION_ABSENT }),
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: { stopped: "load-failed", failure: SELECTION_ABSENT },
    });
    expect(git.trackedPaths).not.toHaveBeenCalled();
  });

  it("stops on a git failure when the tracked files cannot be listed", async () => {
    const git = gitListing({
      tracked: {
        outcome: "failed",
        error: { kind: "git-failed", command: "git ls-files", detail: "not a git repository" },
      },
    });

    expect(await upgradeOf(inputWith({ git }))).toEqual({
      outcome: "failed",
      error: {
        stopped: "load-failed",
        failure: { kind: "git-failed", detail: "git ls-files: not a git repository" },
      },
    });
  });

  it("stops on the shipped catalogues' load failure and reads no records", async () => {
    const recordsOnDiskOf = vi.fn<RecordsOnDiskOf>();

    expect(
      await upgradeOf(
        inputWith({
          git: gitListing({ tracked: TRACKED }),
          catalogues: () => ({ outcome: "failed", error: SELECTION_ABSENT }),
          recordsOnDiskOf,
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: { stopped: "load-failed", failure: SELECTION_ABSENT },
    });
    expect(recordsOnDiskOf).not.toHaveBeenCalled();
  });

  it("refuses when the version 1 records cannot be read", async () => {
    const recordsOnDiskOf = vi.fn<RecordsOnDiskOf>().mockReturnValue({
      outcome: "ok",
      value: { files: [], folders: [], root: { kind: "repository" } },
    });
    const versionOneReadOf = vi.fn<VersionOneReadOf>().mockReturnValue({
      outcome: "failed",
      error: { kind: "version-one-unreadable", failure: SELECTION_ABSENT },
    });

    expect(
      await upgradeOf(
        inputWith({ git: gitListing({ tracked: TRACKED }), recordsOnDiskOf, versionOneReadOf }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        stopped: "refused",
        failure: { kind: "version-one-unreadable", failure: SELECTION_ABSENT },
      },
    });
  });

  describe("reading mentions once the proof is decided", () => {
    const CARRIED: ProofCarriedOver = {
      written: [],
      replaced: [],
      removed: { files: [], folders: [] },
      records: [],
      findings: 0,
    };

    const versionOneReadExcludingVendor = vi.fn<VersionOneReadOf>().mockReturnValue({
      outcome: "ok",
      value: {
        reading: {
          selection: {
            version: 1,
            ruleSets: [],
            clauses: [],
            exclude: [repoPathOf("vendor")],
            eslintConfigRoots: [],
            fileExceptionWhyChains: "required",
            reportOutput: "full",
            assessment: { forfeiture: "this-run" },
            clauseSettings: [],
            checkEditions: "pinned",
          },
          heads: [],
        },
        versionOneFiles: {
          recordsFiles: [],
          recordsFolders: [],
          recordsRoot: { kind: "repository" },
          settings: repoPathOf("disciplines.json"),
        },
      },
    });

    const recordsOnDisk = vi.fn<RecordsOnDiskOf>().mockReturnValue({
      outcome: "ok",
      value: { files: [], folders: [], root: { kind: "repository" } },
    });

    it("reads the tracked files outside the version 1 exclude and returns what they mention when the proof is ok", async () => {
      const git = gitListing({
        tracked: {
          outcome: "ok",
          value: [repoPathOf("package.json"), repoPathOf("vendor/x.md")],
        },
      });
      const read = vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '"lint": "cat disciplines.json"' });
      const join = vi.fn<PathPort["join"]>().mockReturnValueOnce("/repo/package.json");
      const proofOf = vi.fn().mockResolvedValue({ outcome: "ok", value: CARRIED });
      const command = commandOver({ git });

      expect(
        await upgradeOf(
          inputWith({
            git,
            command: {
              ...command,
              fileText: { ...command.fileText, read },
              path: { ...command.path, join },
            },
            recordsOnDiskOf: recordsOnDisk,
            versionOneReadOf: versionOneReadExcludingVendor,
            proofOf,
          }),
        ),
      ).toEqual({
        outcome: "ok",
        value: { ...CARRIED, mentions: [{ file: "package.json", line: 1 }], unread: [] },
      });
      expect(read.mock.calls).toEqual([[{ path: "/repo/package.json" }]]);
    });

    it("reads no tracked file when the proof is refused", async () => {
      const git = gitListing({
        tracked: { outcome: "ok", value: [repoPathOf("package.json")] },
      });
      const read = vi.fn<FileTextPort["read"]>();
      const proofOf = vi.fn().mockResolvedValue({
        outcome: "failed",
        error: {
          kind: "unplaceable-path",
          file: repoPathOf("package.json"),
          removedByVersionOne: [],
        },
      });
      const command = commandOver({ git });

      expect(
        await upgradeOf(
          inputWith({
            git,
            command: { ...command, fileText: { ...command.fileText, read } },
            recordsOnDiskOf: recordsOnDisk,
            versionOneReadOf: versionOneReadExcludingVendor,
            proofOf,
          }),
        ),
      ).toEqual({
        outcome: "failed",
        error: {
          stopped: "refused",
          failure: {
            kind: "unplaceable-path",
            file: "package.json",
            removedByVersionOne: [],
          },
        },
      });
      expect(read).not.toHaveBeenCalled();
    });
  });
});

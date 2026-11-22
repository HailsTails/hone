import { describe, expect, it, vi } from "vitest";

import type { GitPort } from "../../application/ports/git-port.ts";
import type {
  RecordsOnDiskOf,
  VersionOneReadOf,
} from "../../application/ports/records/version-one-reading.ts";
import type { RunSettingsOf } from "../../application/ports/selection/selection-repository.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
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
});

import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../../application/ports/file-system/directory-removal-port.ts";
import type { FileCreationPort } from "../../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../../application/ports/git-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type {
  RecordsOnDiskOf,
  VersionOneReadOf,
} from "../../application/ports/records/version-one-reading.ts";
import type { RunSettingsOf } from "../../application/ports/selection/selection-repository.ts";
import type { ProofCarriedOver } from "../../application/ports/upgrade/proof-outcome.ts";
import type { ProofRuns, ProofRunsOf } from "../../application/ports/upgrade/proof-runs.ts";
import type {
  ImportsRewrittenOf,
  VersionOneTeamLayout,
} from "../../application/ports/upgrade/version-one-team-layout.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import type { VersionTwoStages } from "../../application/run/version-two-run.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import { type UpgradeInput, type UpgradePorts, upgradeOf } from "./run-upgrade-command.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const SELECTION_ABSENT: LoadFailure = { kind: "selection-absent", repo: "/repo" };

const SETTINGS_READ: ReturnType<RunSettingsOf> = {
  outcome: "ok",
  value: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
};

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
  recordsReader: { recordsReadingOf: vi.fn(), readEntries: vi.fn() },
  boundCatalogueOf: vi.fn(),
  settingsFormat: { fileOf: vi.fn(), documentOf: vi.fn(), textOf: vi.fn(), renameKeys: vi.fn() },
  settingsSourcesOf: vi.fn(),
  checkPieceSourceOf: vi.fn(),
  namedEngine: { load: vi.fn(), run: vi.fn(), project: vi.fn() },
  versionOneProjectionOf: vi.fn(),
  directory: { list: vi.fn(), create: vi.fn() },
  fileCreation: { createNew: vi.fn() },
  fileRemoval: { remove: vi.fn() },
  directoryRemoval: { removeEmpty: vi.fn() },
  entryKind: { kindOf: vi.fn() },
  loadFailureDetail: vi.fn(),
  recordsEditor: {
    documentsWithAdded: vi.fn(),
    placeOfAddition: vi.fn(),
    documentsWithRepointed: vi.fn(),
    documentsWithRemoved: vi.fn(),
  },
};

const inputWith = (request: Partial<UpgradeInput> & { readonly git: GitPort }): UpgradeInput => ({
  command: commandOver({ git: request.git }),
  ports: PORTS,
  measureVersionOne: vi.fn<UpgradeInput["measureVersionOne"]>(),
  located: { repoRoot: REPO_ROOT, installRoot: absoluteRootOf("/install") },
  runSettingsOf: vi.fn<RunSettingsOf>().mockReturnValue(SETTINGS_READ),
  catalogues: () => ({ outcome: "ok", value: [] }),
  externalCataloguesOf: () => ({ outcome: "ok", value: [] }),
  versionOneTeamLayoutsOf: () => ({ outcome: "ok", value: [] }),
  itemTextOf: vi.fn<UpgradeInput["itemTextOf"]>(),
  importsRewriterOf: vi
    .fn<UpgradeInput["importsRewriterOf"]>()
    .mockResolvedValue({ outcome: "ok", value: vi.fn<ImportsRewrittenOf>() }),
  recordsOnDiskOf: vi.fn<RecordsOnDiskOf>(),
  versionOneReadOf: vi.fn<VersionOneReadOf>(),
  proofRunsOf: vi.fn(),
  proofOf: vi.fn(),
  foundTreeReach: vi.fn(),
  pointers: {
    symptomPage: "rules/typescript/symptoms.md",
    pruneCommand: "hone prune-debt --repo /repo",
    projectCommand: "hone project --repo /repo",
  },
  ...request,
});

const TRACKED: ReturnType<GitPort["trackedPaths"]> = { outcome: "ok", value: [] };

const VERSION_ONE_READ_EXCLUDING_VENDOR: ReturnType<VersionOneReadOf> = {
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
};

const RECORDS_ON_DISK: ReturnType<RecordsOnDiskOf> = {
  outcome: "ok",
  value: { files: [], folders: [], root: { kind: "repository" } },
};

const CONSOLE_CLAUSE = {
  ruleSet: { name: ruleSetNameOf("acme") },
  discipline: disciplineIdOf("ACME-1"),
  clause: clauseIdOf("console-calls"),
};

const UNPIECED_LAYOUT: VersionOneTeamLayout = {
  ruleSet: { name: ruleSetNameOf("acme") },
  location: { location: "folder", path: repoPathOf("acme") },
  namesFile: repoPathOf("acme/version-two-names.json"),
  clauses: [
    {
      clause: CONSOLE_CLAUSE,
      naming: { naming: "unnamed" },
      summary: "no direct console output",
      anchor: { kind: "file" },
      exceptions: "allowed",
      cases: { flag: [], allow: [] },
      pieces: [],
    },
  ],
  definitions: [],
  versionOneFiles: [],
};

const PIECED_LAYOUT: VersionOneTeamLayout = {
  ...UNPIECED_LAYOUT,
  clauses: [
    {
      clause: CONSOLE_CLAUSE,
      naming: { naming: "unnamed" },
      summary: "no direct console output",
      anchor: { kind: "file" },
      exceptions: "allowed",
      cases: { flag: [], allow: [] },
      pieces: [
        {
          mechanism: "walker",
          settings: { module: "console.ts" },
          checkSettings: {},
          editions: { declared: [editionOf("1")], default: editionOf("1"), latest: editionOf("1") },
          folder: repoPathOf("acme/mechanisms/audit/ACME-1"),
          module: repoPathOf("console.ts"),
          files: [{ file: repoPathOf("console.ts"), text: "export const check = {};\n" }],
        },
      ],
    },
  ],
};

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

  it("stops on a team rule set's load failure before the proof", async () => {
    const proofOf = vi.fn<UpgradeInput["proofOf"]>();

    expect(
      await upgradeOf(
        inputWith({
          git: gitListing({ tracked: TRACKED }),
          recordsOnDiskOf: vi.fn<RecordsOnDiskOf>().mockReturnValue(RECORDS_ON_DISK),
          versionOneReadOf: vi
            .fn<VersionOneReadOf>()
            .mockReturnValue(VERSION_ONE_READ_EXCLUDING_VENDOR),
          versionOneTeamLayoutsOf: () => ({ outcome: "failed", error: SELECTION_ABSENT }),
          proofOf,
        }),
      ),
    ).toEqual({ outcome: "failed", error: { stopped: "load-failed", failure: SELECTION_ABSENT } });
    expect(proofOf).not.toHaveBeenCalled();
  });

  it("stops on the load failure of the TypeScript that rewrites a team's moved imports, before the proof", async () => {
    const proofOf = vi.fn<UpgradeInput["proofOf"]>();

    expect(
      await upgradeOf(
        inputWith({
          git: gitListing({ tracked: TRACKED }),
          recordsOnDiskOf: vi.fn<RecordsOnDiskOf>().mockReturnValue(RECORDS_ON_DISK),
          versionOneReadOf: vi
            .fn<VersionOneReadOf>()
            .mockReturnValue(VERSION_ONE_READ_EXCLUDING_VENDOR),
          versionOneTeamLayoutsOf: () => ({ outcome: "ok", value: [PIECED_LAYOUT] }),
          importsRewriterOf: vi
            .fn<UpgradeInput["importsRewriterOf"]>()
            .mockResolvedValue({ outcome: "failed", error: SELECTION_ABSENT }),
          proofOf,
        }),
      ),
    ).toEqual({ outcome: "failed", error: { stopped: "load-failed", failure: SELECTION_ABSENT } });
    expect(proofOf).not.toHaveBeenCalled();
  });

  it("refuses a team rule set with an unnamed clause before the proof, naming the clause and its names file, loading no import rewriter for a set with no piece folder", async () => {
    const proofOf = vi.fn<UpgradeInput["proofOf"]>();
    const importsRewriterOf = vi.fn<UpgradeInput["importsRewriterOf"]>();

    expect(
      await upgradeOf(
        inputWith({
          git: gitListing({ tracked: TRACKED }),
          recordsOnDiskOf: vi.fn<RecordsOnDiskOf>().mockReturnValue(RECORDS_ON_DISK),
          versionOneReadOf: vi
            .fn<VersionOneReadOf>()
            .mockReturnValue(VERSION_ONE_READ_EXCLUDING_VENDOR),
          versionOneTeamLayoutsOf: () => ({
            outcome: "ok",
            value: [UNPIECED_LAYOUT],
          }),
          importsRewriterOf,
          proofOf,
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        stopped: "refused",
        failure: {
          kind: "plan-refused",
          refusal: {
            kind: "team-names-missing",
            missing: [
              {
                missing: "clause",
                clause: CONSOLE_CLAUSE,
                namesFile: "acme/version-two-names.json",
              },
            ],
          },
          removedByVersionOne: [],
        },
      },
    });
    expect(proofOf).not.toHaveBeenCalled();
    expect(importsRewriterOf).not.toHaveBeenCalled();
  });

  describe("reading mentions once the proof is decided", () => {
    const CARRIED: ProofCarriedOver = {
      written: [],
      replaced: [],
      removed: { files: [], folders: [] },
      records: [],
      smoothed: { removedCarried: [], recordedDebt: [], prunedDebt: [], projected: [] },
    };

    it("reads every tracked file, the version 1 exclude included, and returns what they mention when the proof is ok", async () => {
      const git = gitListing({
        tracked: {
          outcome: "ok",
          value: [repoPathOf("package.json"), repoPathOf("vendor/x.md")],
        },
      });
      const read = vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '"lint": "cat disciplines.json"' })
        .mockReturnValueOnce({ outcome: "ok", value: "see disciplines.eslint.d.mts" });
      const join = vi
        .fn<PathPort["join"]>()
        .mockReturnValueOnce("/repo/package.json")
        .mockReturnValueOnce("/repo/vendor/x.md");
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
            recordsOnDiskOf: vi.fn<RecordsOnDiskOf>().mockReturnValue(RECORDS_ON_DISK),
            versionOneReadOf: vi
              .fn<VersionOneReadOf>()
              .mockReturnValue(VERSION_ONE_READ_EXCLUDING_VENDOR),
            proofOf,
          }),
        ),
      ).toEqual({
        outcome: "ok",
        value: {
          ...CARRIED,
          mentions: [
            { file: "package.json", line: 1 },
            { file: "vendor/x.md", line: 1 },
          ],
          unread: [],
        },
      });
      expect(read.mock.calls).toEqual([
        [{ path: "/repo/package.json" }],
        [{ path: "/repo/vendor/x.md" }],
      ]);
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
            recordsOnDiskOf: vi.fn<RecordsOnDiskOf>().mockReturnValue(RECORDS_ON_DISK),
            versionOneReadOf: vi
              .fn<VersionOneReadOf>()
              .mockReturnValue(VERSION_ONE_READ_EXCLUDING_VENDOR),
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
  describe("the proof's effects", () => {
    const FOLDER = absoluteRootOf("/repo/hone-records");

    const FILE = absoluteRootOf("/repo/hone.config.json");

    const OK = { outcome: "ok", value: undefined } as const;

    const ORACLE_FAILED = {
      outcome: "failed",
      error: { kind: "oracle-failed", failure: { kind: "version-one-run-failed", detail: "x" } },
    } as const;

    it("applies each kind of effect through the ports the upgrade was given", async () => {
      const git = gitListing({ tracked: TRACKED });
      const command = commandOver({ git });
      const write = vi.fn<FileTextPort["write"]>().mockReturnValue(OK);
      const create = vi.fn<DirectoryPort["create"]>().mockReturnValue(OK);
      const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({ outcome: "ok", value: [] });
      const createNew = vi.fn<FileCreationPort["createNew"]>().mockReturnValue(OK);
      const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue(OK);
      const removeEmpty = vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(OK);
      const proofOf = vi.fn<UpgradeInput["proofOf"]>().mockResolvedValue(ORACLE_FAILED);

      await upgradeOf(
        inputWith({
          git,
          command: { ...command, fileText: { ...command.fileText, write } },
          ports: {
            ...PORTS,
            directory: { list, create },
            fileCreation: { createNew },
            fileRemoval: { remove },
            directoryRemoval: { removeEmpty },
          },
          recordsOnDiskOf: vi.fn<RecordsOnDiskOf>().mockReturnValue(RECORDS_ON_DISK),
          versionOneReadOf: vi
            .fn<VersionOneReadOf>()
            .mockReturnValue(VERSION_ONE_READ_EXCLUDING_VENDOR),
          proofOf,
        }),
      );
      const [[proofRequest]] = proofOf.mock.calls;
      proofRequest.effects.apply({
        effects: [
          { kind: "create-directory", path: FOLDER },
          { kind: "create-file", path: FILE, text: "settings" },
          { kind: "replace-file", path: FILE, text: "new", original: "old" },
          { kind: "remove-file", path: FILE },
          { kind: "remove-directory-if-empty", path: FOLDER },
        ],
      });

      expect([
        create.mock.calls,
        createNew.mock.calls,
        write.mock.calls,
        remove.mock.calls,
        list.mock.calls,
        removeEmpty.mock.calls,
      ]).toEqual([
        [[{ path: FOLDER }]],
        [[{ path: FILE, text: "settings" }]],
        [[{ path: FILE, text: "new" }]],
        [[{ path: FILE }]],
        [[{ path: FOLDER }]],
        [[{ path: FOLDER }]],
      ]);
    });

    it("undoes each kind of write through the ports the upgrade was given", async () => {
      const git = gitListing({ tracked: TRACKED });
      const command = commandOver({ git });
      const write = vi.fn<FileTextPort["write"]>().mockReturnValue(OK);
      const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue(OK);
      const removeEmpty = vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(OK);
      const proofOf = vi.fn<UpgradeInput["proofOf"]>().mockResolvedValue(ORACLE_FAILED);

      await upgradeOf(
        inputWith({
          git,
          command: { ...command, fileText: { ...command.fileText, write } },
          ports: { ...PORTS, fileRemoval: { remove }, directoryRemoval: { removeEmpty } },
          recordsOnDiskOf: vi.fn<RecordsOnDiskOf>().mockReturnValue(RECORDS_ON_DISK),
          versionOneReadOf: vi
            .fn<VersionOneReadOf>()
            .mockReturnValue(VERSION_ONE_READ_EXCLUDING_VENDOR),
          proofOf,
        }),
      );
      const [[proofRequest]] = proofOf.mock.calls;

      expect(
        proofRequest.effects.undo({
          writes: [
            { kind: "file-replaced", path: FILE, original: "old" },
            { kind: "file-created", path: FILE },
            { kind: "directory-created", path: FOLDER },
          ],
        }),
      ).toEqual([]);
      expect([write.mock.calls, remove.mock.calls, removeEmpty.mock.calls]).toEqual([
        [[{ path: FILE, text: "old" }]],
        [[{ path: FILE }]],
        [[{ path: FOLDER }]],
      ]);
    });
  });

  it("runs the version 2 proof and the smoothing commands over the found tree with the files the upgrade wrote, handing the check the report pointers", async () => {
    const proofRunsOf = vi.fn<ProofRunsOf>().mockReturnValue({
      versionOne: vi.fn<ProofRuns["versionOne"]>(),
      versionTwo: vi.fn<ProofRuns["versionTwo"]>(),
    });
    const stages: VersionTwoStages = {
      catalogue: vi
        .fn<VersionTwoStages["catalogue"]>()
        .mockReturnValue({ outcome: "failed", error: { kind: "config-absent", repo: "/repo" } }),
      settings: vi.fn<VersionTwoStages["settings"]>(),
      records: vi.fn<VersionTwoStages["records"]>(),
      tree: vi.fn<VersionTwoStages["tree"]>(),
      engines: vi.fn<VersionTwoStages["engines"]>(),
      projections: vi.fn<VersionTwoStages["projections"]>(),
      renamed: vi
        .fn<VersionTwoStages["renamed"]>()
        .mockReturnValue({ measured: "yes", renamed: new Map() }),
      touched: vi.fn<VersionTwoStages["touched"]>(),
    };
    const foundTreeReach = vi
      .fn<UpgradeInput["foundTreeReach"]>()
      .mockReturnValue({ stages, recordsSourceFor: vi.fn() });
    const proofOf = vi.fn<UpgradeInput["proofOf"]>().mockResolvedValue({
      outcome: "failed",
      error: {
        kind: "oracle-failed",
        failure: { kind: "version-one-run-failed", detail: "x" },
      },
    });
    const written = { written: [repoPathOf("hone.eslint.d.mts")] };
    await upgradeOf(
      inputWith({
        git: gitListing({ tracked: TRACKED }),
        recordsOnDiskOf: vi.fn<RecordsOnDiskOf>().mockReturnValue(RECORDS_ON_DISK),
        versionOneReadOf: vi
          .fn<VersionOneReadOf>()
          .mockReturnValue(VERSION_ONE_READ_EXCLUDING_VENDOR),
        proofRunsOf,
        proofOf,
        foundTreeReach,
      }),
    );
    const [[sources]] = proofRunsOf.mock.calls;
    const [[proofRequest]] = proofOf.mock.calls;

    const run = await sources.versionTwo(written);
    const projected = await proofRequest.smoothing.project(written);

    expect({
      run,
      projected,
      pointers: sources.pointers,
      reachedFor: foundTreeReach.mock.calls,
    }).toEqual({
      run: { outcome: "failed", error: { kind: "config-absent", repo: "/repo" } },
      projected: {
        outcome: "failed",
        error: { kind: "run-failed", failure: { kind: "config-absent", repo: "/repo" } },
      },
      pointers: {
        symptomPage: "rules/typescript/symptoms.md",
        pruneCommand: "hone prune-debt --repo /repo",
        projectCommand: "hone project --repo /repo",
      },
      reachedFor: [[written], [written]],
    });
  });
});

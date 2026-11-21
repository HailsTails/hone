import { describe, expect, it, vi } from "vitest";
import { SETTINGS_CATALOGUE } from "../../../../tests/settings-catalogue.ts";
import type { CheckRequest } from "../../run/check/run-check.ts";
import type { DirectoryPort } from "../../../infrastructure/node/file-system/file-system-port.ts";
import type { GitPort, GitTreePort } from "../../../infrastructure/git/git-port.ts";
import { createPathPort } from "../../../infrastructure/node/path-port.ts";
import type { RecordsDocument } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import type { RecordsSourceOf } from "../../../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import type { RecordsSource } from "../../ports/records-source.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRepository, PlacedEntry } from "../../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { FOUND_TREE_REVISION, foundTreeCheckReachOf, foundTreeRunReachOf } from "./found-tree-reach.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const ENTRY = { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" } as const;

const PLACED: PlacedEntry = { place: { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 0 }, entry: ENTRY };

const AUTHORISED_DOCUMENT: RecordsDocument = {
  file: repoPathSchema.parse("hone-records/authorised-locations/loop-keyword.json"),
  document: { version: 2, records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: ENTRY }] },
};

const git = (): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const fileText = (): CheckRequest["fileText"] => ({
  read: vi.fn<CheckRequest["fileText"]["read"]>(),
  exists: vi.fn<CheckRequest["fileText"]["exists"]>(),
});

const exceptions = (): ExceptionRepository => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: [PLACED] }),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
  add: vi.fn<ExceptionRepository["add"]>(),
  remove: vi.fn<ExceptionRepository["remove"]>(),
  moveToSplitLayout: vi.fn<ExceptionRepository["moveToSplitLayout"]>(),
});

describe("foundTreeCheckReachOf", () => {
  it("gives a version 1 check the tree the upgrade found as its base revision, git and entries at the base", () => {
    const underlyingGit = git();
    const underlyingExceptions = exceptions();
    const reach = foundTreeCheckReachOf({ check: { git: underlyingGit, fileText: fileText(), path: PATH, exceptionRepository: underlyingExceptions } });
    expect({
      baseRevision: reach.baseRevision,
      changedSince: reach.git.changedSince({ repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION }),
      entriesAtBase: reach.exceptionRepository.readAt({ revision: FOUND_TREE_REVISION }),
      askedGit: [vi.mocked(underlyingGit.changedSince).mock.calls, vi.mocked(underlyingExceptions.readAt).mock.calls],
    }).toEqual({
      baseRevision: FOUND_TREE_REVISION,
      changedSince: { outcome: "ok", value: [] },
      entriesAtBase: { outcome: "ok", value: [ENTRY] },
      askedGit: [[], []],
    });
  });
});

describe("foundTreeRunReachOf", () => {
  it("gives a version 2 run the tree the upgrade found as its base revision and git, and records at the base made from the working tree's entries", () => {
    const underlyingSource: RecordsSource = { read: vi.fn<RecordsSource["read"]>(), readAt: vi.fn<RecordsSource["readAt"]>() };
    const underlyingGit = git();
    const directory: Pick<DirectoryPort, "list"> = { list: vi.fn<DirectoryPort["list"]>() };
    const gitTree: GitTreePort = { pathsAt: vi.fn<GitTreePort["pathsAt"]>() };
    const reach = foundTreeRunReachOf({
      recordsSourceOf: vi.fn<RecordsSourceOf>().mockReturnValue(underlyingSource),
      command: { git: underlyingGit, fileText: fileText(), path: PATH, exceptionRepositoryOf: () => exceptions() },
    });
    const folder = { fileText: fileText(), path: PATH, directory, git: underlyingGit, gitTree, repoRoot: REPO_ROOT, catalogue: SETTINGS_CATALOGUE };
    expect({
      baseRevision: reach.baseRevision,
      changedSince: reach.git.changedSince({ repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION }),
      recordsAtBase: reach.recordsSourceOf(folder).readAt({ revision: FOUND_TREE_REVISION }),
      askedRecords: vi.mocked(underlyingSource.readAt).mock.calls,
    }).toEqual({
      baseRevision: FOUND_TREE_REVISION,
      changedSince: { outcome: "ok", value: [] },
      recordsAtBase: { outcome: "ok", value: [AUTHORISED_DOCUMENT] },
      askedRecords: [],
    });
  });
});

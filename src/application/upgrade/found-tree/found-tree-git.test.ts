import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { foundTreeGitOf } from "./found-tree-git.ts";
import { FOUND_TREE_REVISION } from "./found-tree-reach.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const FILE = repoPathOf("src/a.ts");

const WRITTEN = repoPathOf("hone.eslint.d.mts");

const PATH: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/src/a.ts"),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const underlyingGit = (): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: [FILE] }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const treeHolding = (request: { readonly text: string }) => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
});

const treeLacking = () => ({
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
});

const treeUnreadable = () => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "unreadable", path: "/repo/src/a.ts", detail: "EACCES" },
  }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
});

const foundTreeOver = (request: {
  readonly fileText: Parameters<typeof foundTreeGitOf>[0]["fileText"];
  readonly written: readonly RepoPath[];
  readonly removed: readonly RepoPath[];
}) => {
  const git = underlyingGit();
  return {
    git,
    found: foundTreeGitOf({
      git,
      fileText: request.fileText,
      path: PATH,
      written: request.written,
      removed: request.removed,
    }),
  };
};

const QUERY = { repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION, file: FILE };

describe("foundTreeGitOf, git with the tree the upgrade found as its base", () => {
  it("reports nothing changed since the base, which is the tree itself, and never asks git", () => {
    const { found, git } = foundTreeOver({ fileText: treeLacking(), written: [], removed: [] });
    expect({
      changed: found.changedSince({
        baseScope: "merge-base",
        repoRoot: REPO_ROOT,
        baseRevision: FOUND_TREE_REVISION,
      }),
      asked: vi.mocked(git.changedSince).mock.calls,
    }).toEqual({
      changed: { outcome: "ok", value: [] },
      asked: [],
    });
  });

  it("reports nothing renamed since the base, which is the tree itself, and never asks git", () => {
    const { found, git } = foundTreeOver({ fileText: treeLacking(), written: [], removed: [] });
    expect({
      renamed: found.renamedSince({ repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION }),
      asked: vi.mocked(git.renamedSince).mock.calls,
    }).toEqual({
      renamed: { outcome: "ok", value: new Map() },
      asked: [],
    });
  });

  it("reads a file's text in the base from the working tree, at the file's place in the repository", () => {
    const fileText = treeHolding({ text: "export const a = 1;\n" });
    const { found } = foundTreeOver({ fileText, written: [], removed: [] });
    expect({ text: found.textInBase(QUERY), read: vi.mocked(fileText.read).mock.calls }).toEqual({
      text: {
        outcome: "ok",
        value: { presence: "present-in-base", text: "export const a = 1;\n" },
      },
      read: [[{ path: "/repo/src/a.ts" }]],
    });
  });

  it("reports a file the working tree lacks as absent from the base", () => {
    const { found } = foundTreeOver({ fileText: treeLacking(), written: [], removed: [] });
    expect(found.textInBase(QUERY)).toEqual({
      outcome: "ok",
      value: { presence: "absent-from-base" },
    });
  });

  it("fails, naming the tree, when a file the working tree holds cannot be read, rather than calling it absent", () => {
    const { found } = foundTreeOver({ fileText: treeUnreadable(), written: [], removed: [] });
    expect(found.textInBase(QUERY)).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "read the tree the upgrade found", detail: "EACCES" },
    });
  });

  it("reports a file's membership in the base from the working tree", () => {
    const present = foundTreeOver({
      fileText: treeHolding({ text: "x" }),
      written: [],
      removed: [],
    });
    const absent = foundTreeOver({ fileText: treeLacking(), written: [], removed: [] });
    expect({
      present: present.found.contentInBase(QUERY),
      absent: absent.found.contentInBase(QUERY),
    }).toEqual({
      present: { outcome: "ok", value: "present-in-base" },
      absent: { outcome: "ok", value: "absent-from-base" },
    });
  });

  it("leaves the tracked paths to the git it wraps when the upgrade has written nothing", () => {
    const { found } = foundTreeOver({ fileText: treeLacking(), written: [], removed: [] });
    expect(found.trackedPaths({ repoRoot: REPO_ROOT })).toEqual({ outcome: "ok", value: [FILE] });
  });

  it("counts each file the upgrade wrote as tracked, once, as committing the upgrade will", () => {
    const { found } = foundTreeOver({
      fileText: treeLacking(),
      written: [WRITTEN, FILE],
      removed: [],
    });
    expect(found.trackedPaths({ repoRoot: REPO_ROOT })).toEqual({
      outcome: "ok",
      value: [FILE, WRITTEN],
    });
  });

  it("leaves out what the upgrade removes, then adds what it writes, so a file in both stays", () => {
    const moved = repoPathOf("rules/acme/old.ts");
    const { found, git } = foundTreeOver({
      fileText: treeLacking(),
      written: [WRITTEN, FILE],
      removed: [moved, FILE],
    });
    vi.mocked(git.trackedPaths).mockReturnValue({ outcome: "ok", value: [moved, FILE] });

    const tracked = found.trackedPaths({ repoRoot: REPO_ROOT });

    expect(tracked).toEqual({ outcome: "ok", value: [WRITTEN, FILE] });
  });

  it("hands back the wrapped git's failure to list tracked paths, adding nothing", () => {
    const { found, git } = foundTreeOver({
      fileText: treeLacking(),
      written: [WRITTEN],
      removed: [],
    });
    const failure = {
      outcome: "failed",
      error: { kind: "git-failed", command: "git ls-files", detail: "not a repository" },
    } as const;
    vi.mocked(git.trackedPaths).mockReturnValue(failure);
    expect(found.trackedPaths({ repoRoot: REPO_ROOT })).toEqual(failure);
  });
});

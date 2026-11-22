import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { foundTreeGitOf } from "./found-tree-git.ts";
import { FOUND_TREE_REVISION } from "./found-tree-reach.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const FILE = repoPathOf("src/a.ts");

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

type Tree = Pick<FileTextPort, "read" | "exists">;

const treeHolding = (request: { readonly text: string }): Tree => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
});

const treeLacking = (): Tree => ({
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
});

const treeUnreadable = (): Tree => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "unreadable", path: "/repo/src/a.ts", detail: "EACCES" },
  }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
});

const foundTreeOver = (request: { readonly fileText: Tree }) => {
  const git = underlyingGit();
  return { git, found: foundTreeGitOf({ git, fileText: request.fileText, path: PATH }) };
};

const QUERY = { repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION, file: FILE };

describe("foundTreeGitOf, git with the tree the upgrade found as its base", () => {
  it("reports nothing changed since the base, which is the tree itself, and never asks git", () => {
    const { found, git } = foundTreeOver({ fileText: treeLacking() });
    expect({
      changed: found.changedSince({ repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION }),
      asked: vi.mocked(git.changedSince).mock.calls,
    }).toEqual({
      changed: { outcome: "ok", value: [] },
      asked: [],
    });
  });

  it("reports nothing renamed since the base, which is the tree itself, and never asks git", () => {
    const { found, git } = foundTreeOver({ fileText: treeLacking() });
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
    const { found } = foundTreeOver({ fileText });
    expect({ text: found.textInBase(QUERY), read: vi.mocked(fileText.read).mock.calls }).toEqual({
      text: {
        outcome: "ok",
        value: { presence: "present-in-base", text: "export const a = 1;\n" },
      },
      read: [[{ path: "/repo/src/a.ts" }]],
    });
  });

  it("reports a file the working tree lacks as absent from the base", () => {
    const { found } = foundTreeOver({ fileText: treeLacking() });
    expect(found.textInBase(QUERY)).toEqual({
      outcome: "ok",
      value: { presence: "absent-from-base" },
    });
  });

  it("fails, naming the tree, when a file the working tree holds cannot be read, rather than calling it absent", () => {
    const { found } = foundTreeOver({ fileText: treeUnreadable() });
    expect(found.textInBase(QUERY)).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "read the tree the upgrade found", detail: "EACCES" },
    });
  });

  it("reports a file's membership in the base from the working tree", () => {
    const present = foundTreeOver({ fileText: treeHolding({ text: "x" }) });
    const absent = foundTreeOver({ fileText: treeLacking() });
    expect({
      present: present.found.contentInBase(QUERY),
      absent: absent.found.contentInBase(QUERY),
    }).toEqual({
      present: { outcome: "ok", value: "present-in-base" },
      absent: { outcome: "ok", value: "absent-from-base" },
    });
  });

  it("leaves the tracked paths to the git it wraps", () => {
    const { found } = foundTreeOver({ fileText: treeLacking() });
    expect(found.trackedPaths({ repoRoot: REPO_ROOT })).toEqual({ outcome: "ok", value: [FILE] });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../../infrastructure/git/git-port.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { checkedTreeOf, typescriptFilesOf } from "./checked-tree-of.ts";

const REPO = absolutePathSchema.parse("/repo");

const A = repoPathSchema.parse("src/a.ts");

const PACKAGES_WEB = repoPathSchema.parse("packages/web");

const DIST_B = repoPathSchema.parse("dist/b.ts");

const WEB_X = repoPathSchema.parse("packages/web/x.ts");

const DIST = repoPathSchema.parse("dist");

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const trackedByGit = (request: { readonly tracked: readonly RepoPath[] }): Pick<GitPort, "trackedPaths"> => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
});

const ALL_PRESENT: Pick<FileTextPort, "exists"> = { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present") };

const treeOver = (request: { readonly tracked: readonly RepoPath[]; readonly excluded: readonly RepoPath[]; readonly roots: readonly RepoPath[] }) =>
  checkedTreeOf({
    git: trackedByGit(request),
    fileText: ALL_PRESENT,
    path: POSIX,
    repoRoot: REPO,
    excluded: request.excluded,
    eslintConfigRoots: request.roots,
  });

describe("checkedTreeOf", () => {
  it("gives the tracked files that are present and not excluded, and the declared config roots", () => {
    expect(treeOver({ tracked: [A, DIST_B, WEB_X], excluded: [DIST], roots: [PACKAGES_WEB] })).toEqual({
      outcome: "ok",
      value: { tracked: [A, WEB_X], declaredConfigRoots: [PACKAGES_WEB] },
    });
  });

  it("leaves out a tracked file that is not on disk", () => {
    const absent: Pick<FileTextPort, "exists"> = { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    expect(
      checkedTreeOf({ git: trackedByGit({ tracked: [A] }), fileText: absent, path: POSIX, repoRoot: REPO, excluded: [], eslintConfigRoots: [] }),
    ).toEqual({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } });
  });

  it("fails as a git failure when git cannot list the tracked files", () => {
    const failing: Pick<GitPort, "trackedPaths"> = {
      trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a repository" } }),
    };
    expect(checkedTreeOf({ git: failing, fileText: ALL_PRESENT, path: POSIX, repoRoot: REPO, excluded: [], eslintConfigRoots: [] })).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "git ls-files: not a repository" },
    });
  });

  it("fails naming a declared config root that holds no tracked file", () => {
    expect(treeOver({ tracked: [A], excluded: [], roots: [PACKAGES_WEB] })).toEqual({
      outcome: "failed",
      error: { kind: "config-root-untracked", root: PACKAGES_WEB },
    });
  });
});

describe("typescriptFilesOf", () => {
  it("gives the tracked files with a TypeScript extension, and no other", () => {
    expect(
      typescriptFilesOf({
        tracked: [
          repoPathSchema.parse("src/a.ts"),
          repoPathSchema.parse("src/b.tsx"),
          repoPathSchema.parse("src/c.mts"),
          repoPathSchema.parse("src/d.cts"),
          repoPathSchema.parse("src/e.js"),
          repoPathSchema.parse("README.md"),
        ],
      }),
    ).toEqual(["src/a.ts", "src/b.tsx", "src/c.mts", "src/d.cts"]);
  });
});

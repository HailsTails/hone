import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import type { GitFailure } from "../../../domain/repository/git-failure.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../domain/result.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { baseRevisionAvailabilityOf, computeTouchedSet } from "./touched-set.ts";

const REPO_ROOT = absoluteRootOf("/repo");
const A = repoPathOf("a.ts");
const B = repoPathOf("src/b.md");

const FAILURE: GitFailure = {
  kind: "git-failed",
  command: "git diff --name-only -z HEAD",
  detail: "fatal: bad revision",
};

const okPaths = (): Result<readonly (typeof A)[], GitFailure> => ({
  outcome: "ok",
  value: [A, B, A],
});

const failed = (): Result<readonly (typeof A)[], GitFailure> => ({
  outcome: "failed",
  error: FAILURE,
});

const fakeGit = (changedSince: GitPort["changedSince"]): GitPort => ({
  trackedPaths: () => ({ outcome: "ok", value: [] }),
  changedSince,
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

describe("computeTouchedSet", () => {
  it("measures the de-duplicated changed paths when a base revision is given", () => {
    const touched = computeTouchedSet({
      baseScope: "merge-base",
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(okPaths),
    });

    expect(touched).toEqual({ measured: "yes", paths: new Set([A, B]) });
  });

  it("asks git for the changes since the given base under the given root", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

    computeTouchedSet({
      baseScope: "merge-base",
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(changedSince),
    });

    expect(changedSince).toHaveBeenCalledWith({
      repoRoot: "/repo",
      baseRevision: "abc123",
      baseScope: "merge-base",
    });
  });

  it("is unmeasured with no-base-revision when no base revision is given", () => {
    const touched = computeTouchedSet({
      baseScope: "merge-base",
      repoRoot: REPO_ROOT,
      baseRevision: undefined,
      git: fakeGit(okPaths),
    });

    expect(touched).toEqual({ measured: "no", base: { state: "not-given" } });
  });

  it("does not run git when no base revision is given", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

    computeTouchedSet({
      baseScope: "merge-base",
      repoRoot: REPO_ROOT,
      baseRevision: undefined,
      git: fakeGit(changedSince),
    });

    expect(changedSince).not.toHaveBeenCalled();
  });

  it("is unmeasured with the base git failed on, carrying git's own message, when git fails", () => {
    const touched = computeTouchedSet({
      baseScope: "merge-base",
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(failed),
    });

    expect(touched).toEqual({
      measured: "no",
      base: { state: "git-failed", revision: "abc123", gitMessage: "fatal: bad revision" },
    });
  });
});

describe("baseRevisionAvailabilityOf", () => {
  it("keeps the first line git wrote when git fails otherwise", () => {
    expect(
      baseRevisionAvailabilityOf({
        revision: "HEAD",
        failure: {
          kind: "git-failed",
          command: "git ls-tree",
          detail:
            "\n  fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'  \nhint: more\n",
        },
      }),
    ).toEqual({
      state: "git-failed",
      revision: "HEAD",
      gitMessage: "fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'",
    });
  });

  it("keeps an empty message when git wrote none", () => {
    expect(
      baseRevisionAvailabilityOf({
        revision: "HEAD",
        failure: { kind: "git-failed", command: "git ls-tree", detail: "" },
      }),
    ).toEqual({ state: "git-failed", revision: "HEAD", gitMessage: "" });
  });
});

it("passes the pinned-ancestor requirement through to change measurement", () => {
  const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

  const touched = computeTouchedSet({
    repoRoot: REPO_ROOT,
    baseRevision: "pinned",
    baseScope: "pinned-ancestor",
    git: fakeGit(changedSince),
  });

  expect(changedSince).toHaveBeenCalledExactlyOnceWith({
    repoRoot: REPO_ROOT,
    baseRevision: "pinned",
    baseScope: "pinned-ancestor",
  });
  expect(touched).toEqual({ measured: "yes", paths: new Set([A, B]), landingRevision: "pinned" });
});

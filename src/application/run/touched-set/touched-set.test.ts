import { describe, expect, it, vi } from "vitest";
import type { GitFailure, GitPort } from "../../../infrastructure/git/git-port.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import type { Equal } from "../../../infrastructure/engines/protocol/runner-module/type-equality.ts";
import { baseJudgementOf, baseRevisionAvailabilityOf, computeTouchedSet, type TouchedSet } from "./touched-set.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const A = repoPathSchema.parse("a.ts");
const B = repoPathSchema.parse("src/b.md");

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

const measuredMemberKeysArePaths: Equal<
  keyof Extract<TouchedSet, { readonly measured: "yes" }>,
  "measured" | "paths"
> = true;

describe("computeTouchedSet", () => {
  it("names the measured member's field paths", () => {
    expect(measuredMemberKeysArePaths).toBe(true);
  });

  it("measures the de-duplicated changed paths when a base revision is given", () => {
    const touched = computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(okPaths),
    });

    expect(touched).toEqual({ measured: "yes", paths: new Set([A, B]) });
  });

  it("asks git for the changes since the given base under the given root", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

    computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(changedSince),
    });

    expect(changedSince).toHaveBeenCalledWith({
      repoRoot: "/repo",
      baseRevision: "abc123",
    });
  });

  it("is unmeasured with no-base-revision when no base revision is given", () => {
    const touched = computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: undefined,
      git: fakeGit(okPaths),
    });

    expect(touched).toEqual({ measured: "no", base: { state: "not-given" } });
  });

  it("does not run git when no base revision is given", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

    computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: undefined,
      git: fakeGit(changedSince),
    });

    expect(changedSince).not.toHaveBeenCalled();
  });

  it("is unmeasured with the base git failed on, carrying git's own message, when git fails", () => {
    const touched = computeTouchedSet({
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
          detail: "\n  fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'  \nhint: more\n",
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
      baseRevisionAvailabilityOf({ revision: "HEAD", failure: { kind: "git-failed", command: "git ls-tree", detail: "" } }),
    ).toEqual({ state: "git-failed", revision: "HEAD", gitMessage: "" });
  });
});

describe("baseJudgementOf", () => {
  it.each<{ readonly name: string; readonly touched: TouchedSet; readonly judgement: "in-this-run" | "left-to-another-run" }>([
    { name: "a touched set measured against a base", touched: { measured: "yes", paths: new Set([A]) }, judgement: "in-this-run" },
    { name: "a touched set that could not be measured", touched: { measured: "no", base: { state: "not-given" } }, judgement: "in-this-run" },
    { name: "a touched set left to another run", touched: { measured: "elsewhere" }, judgement: "left-to-another-run" },
  ])("judges what needs the base $judgement for $name", ({ touched, judgement }) => {
    expect(baseJudgementOf({ touched })).toBe(judgement);
  });
});

import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import {
  createEnvironmentOutsideRepository,
  createGitExecutionPolicy,
  createGitHistoryPort,
  createGitPort,
  createGitTreePort,
  type GitRun,
  type GitSpawn,
} from "./git-port.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const AMBIENT_ENVIRONMENT = {
  GIT_DIR: "/elsewhere/.git",
  GIT_WORK_TREE: "/elsewhere",
  GIT_INDEX_FILE: "/elsewhere/.git/index",
  PATH: "/usr/bin",
  HOME: "/home/someone",
};

const EXITED_WITH_LISTING = {
  outcome: "exited",
  status: 0,
  stdout: "c.ts\0src/a.ts\0",
  stderr: "",
} satisfies GitRun;

const REPOSITORY_LOCATION = "GIT_DIR";

const EXITED_EMPTY = { outcome: "exited", status: 0, stdout: "", stderr: "" } satisfies GitRun;

const EXITED_NOT_A_REPOSITORY = {
  outcome: "exited",
  status: 128,
  stdout: "",
  stderr: "fatal: not a git repository",
} satisfies GitRun;

const ERRORED_ON_BUFFER = { outcome: "errored", detail: "spawnSync git ENOBUFS" } satisfies GitRun;

const gitOver = (spawn: GitSpawn) =>
  createGitPort({ spawn, ambientEnvironment: AMBIENT_ENVIRONMENT });

describe("createGitPort trackedPaths", () => {
  it("runs git ls-files -z under the request's root", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    gitOver(spawn).trackedPaths({ repoRoot: REPO_ROOT });

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({ file: "git", arguments: ["-C", "/repo", "ls-files", "-z"] }),
    );
  });

  it("hands git the ambient environment without any repository location variable", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    gitOver(spawn).trackedPaths({ repoRoot: REPO_ROOT });

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({ environment: { PATH: "/usr/bin", HOME: "/home/someone" } }),
    );
  });

  it("splits NUL-separated output, with its trailing NUL, into unquoted paths", () => {
    const trackedListing = gitOver(
      vi.fn<GitSpawn>().mockReturnValue(EXITED_WITH_LISTING),
    ).trackedPaths({ repoRoot: REPO_ROOT });

    expect(trackedListing).toEqual({ outcome: "ok", value: ["c.ts", "src/a.ts"] });
  });

  it("names the first path that is not a repo path when several are refused", () => {
    const trackedListing = gitOver(
      vi.fn<GitSpawn>().mockReturnValue({
        ...EXITED_WITH_LISTING,
        stdout: "a.ts\0../first.ts\0b.ts\0../second.ts\0",
      }),
    ).trackedPaths({ repoRoot: REPO_ROOT });

    expect(trackedListing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-files -z",
        detail: "git listed a path that is not a repo path: ../first.ts",
      },
    });
  });

  it("lists no paths for empty output", () => {
    const trackedListing = gitOver(vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY)).trackedPaths({
      repoRoot: REPO_ROOT,
    });

    expect(trackedListing).toEqual({ outcome: "ok", value: [] });
  });

  it("returns git-failed carrying stderr when git exits non-zero", () => {
    const trackedListing = gitOver(
      vi.fn<GitSpawn>().mockReturnValue(EXITED_NOT_A_REPOSITORY),
    ).trackedPaths({ repoRoot: REPO_ROOT });

    expect(trackedListing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-files -z",
        detail: "fatal: not a git repository",
      },
    });
  });

  it("returns git-failed carrying the error when git could not run to completion", () => {
    const trackedListing = gitOver(
      vi.fn<GitSpawn>().mockReturnValue(ERRORED_ON_BUFFER),
    ).trackedPaths({ repoRoot: REPO_ROOT });

    expect(trackedListing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-files -z",
        detail: "spawnSync git ENOBUFS",
      },
    });
  });
});

describe("createGitPort changedSince", () => {
  it("diffs the base range with --end-of-options before it", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(spawn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        arguments: ["-C", "/repo", "diff", "--name-only", "-z", "--end-of-options", "base...HEAD"],
      }),
    );
  });

  it("diffs the worktree against HEAD second", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(spawn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ arguments: ["-C", "/repo", "diff", "--name-only", "-z", "HEAD"] }),
    );
  });

  it("unites committed, uncommitted and untracked paths in first-encounter order", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "z.ts\0shared.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "shared.ts\0a.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "a.ts\0z.ts\0untracked.ts\0" });

    const changedListing = gitOver(spawn).changedSince({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
    });

    expect(changedListing).toEqual({
      outcome: "ok",
      value: ["z.ts", "shared.ts", "a.ts", "untracked.ts"],
    });
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(spawn).toHaveBeenNthCalledWith(3, {
      file: "git",
      arguments: ["-C", "/repo", "ls-files", "--others", "--exclude-standard", "-z"],
      maxBuffer: 268435456,
      environment: { PATH: "/usr/bin", HOME: "/home/someone" },
    });
  });

  it("lists a path in both diffs once", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "a.ts\0c.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "c.ts\0b.ts\0" })
      .mockReturnValueOnce(EXITED_EMPTY);

    const changedListing = gitOver(spawn).changedSince({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
    });

    expect(changedListing).toHaveProperty("value.length", 3);
  });

  it("returns git-failed when the committed diff fails", () => {
    const changedListing = gitOver(
      vi
        .fn<GitSpawn>()
        .mockReturnValueOnce(EXITED_NOT_A_REPOSITORY)
        .mockReturnValueOnce(EXITED_EMPTY),
    ).changedSince({ repoRoot: REPO_ROOT, baseRevision: "no-such-revision" });

    expect(changedListing).toMatchObject({
      outcome: "failed",
      error: { kind: "git-failed", detail: "fatal: not a git repository" },
    });
  });

  it("fails without returning a successful prefix when the untracked operation cannot complete", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce(EXITED_WITH_LISTING)
      .mockReturnValueOnce(EXITED_EMPTY)
      .mockReturnValueOnce(ERRORED_ON_BUFFER);

    const changedListing = gitOver(spawn).changedSince({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
    });

    expect(changedListing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-files --others --exclude-standard -z",
        detail: "spawnSync git ENOBUFS",
      },
    });
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it("refuses an invalid later untracked path without publishing any successful prefix", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce(EXITED_WITH_LISTING)
      .mockReturnValueOnce(EXITED_EMPTY)
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "new.ts\0../outside.ts\0" });

    const changedListing = gitOver(spawn).changedSince({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
    });

    expect(changedListing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-files --others --exclude-standard -z",
        detail: "git listed a path that is not a repo path: ../outside.ts",
      },
    });
  });
});

const CANDIDATE_HASH = "0123456789abcdef0123456789abcdef01234567";
const OTHER_HASH = "abcdef0123456789abcdef0123456789abcdef01";
const SHA256_HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER_SHA256_HASH = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const CONTENT_FILE = repoPathOf("src/example.ts");

describe("createGitPort contentInBase", () => {
  it("finds exact candidate content in the selected tree using option-safe arguments and Git policy", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: `${CANDIDATE_HASH}\r\n` })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: `${OTHER_HASH}\0${CANDIDATE_HASH}\0` });

    const membership = gitOver(spawn).contentInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "-selected-base",
      file: repoPathOf("-candidate.ts"),
    });

    expect(membership).toEqual({ outcome: "ok", value: "present-in-base" });
    expect(spawn.mock.calls).toEqual([
      [
        {
          file: "git",
          arguments: ["-C", "/repo", "hash-object", "--", "-candidate.ts"],
          maxBuffer: 268435456,
          environment: { PATH: "/usr/bin", HOME: "/home/someone" },
        },
      ],
      [
        {
          file: "git",
          arguments: [
            "-C",
            "/repo",
            "ls-tree",
            "-r",
            "-z",
            "--format=%(objectname)",
            "--end-of-options",
            "-selected-base",
          ],
          maxBuffer: 268435456,
          environment: { PATH: "/usr/bin", HOME: "/home/someone" },
        },
      ],
    ]);
  });

  it.each([
    {
      name: "unmatched content despite other tree objects",
      hashOutput: `${SHA256_HASH}\n`,
      treeOutput: `${OTHER_SHA256_HASH}\0`,
    },
    { name: "a successfully read empty base tree", hashOutput: CANDIDATE_HASH, treeOutput: "" },
  ])("returns absent for $name", ({ hashOutput, treeOutput }) => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: hashOutput })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: treeOutput });

    const membership = gitOver(spawn).contentInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
      file: CONTENT_FILE,
    });

    expect(membership).toEqual({ outcome: "ok", value: "absent-from-base" });
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        arguments: [
          "-C",
          "/repo",
          "ls-tree",
          "-r",
          "-z",
          "--format=%(objectname)",
          "--end-of-options",
          "base",
        ],
      }),
    );
  });

  it.each([
    { name: "empty", stdout: "" },
    { name: "malformed", stdout: "not-an-object\n" },
    { name: "multiple", stdout: `${CANDIDATE_HASH}\n${CANDIDATE_HASH}\n` },
  ])("refuses $name candidate hash output before querying the tree", ({ stdout }) => {
    const spawn = vi.fn<GitSpawn>().mockReturnValueOnce({ ...EXITED_EMPTY, stdout });

    const membership = gitOver(spawn).contentInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
      file: CONTENT_FILE,
    });

    expect(membership).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo hash-object -- src/example.ts",
        detail: expect.stringMatching(/\S/),
      },
    });
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "malformed later entry despite a matching prefix",
      stdout: `${CANDIDATE_HASH}\0not-an-object\0`,
    },
    { name: "unterminated tree entry", stdout: CANDIDATE_HASH },
  ])("refuses $name rather than returning content membership", ({ stdout }) => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: `${CANDIDATE_HASH}\n` })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout });

    const membership = gitOver(spawn).contentInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
      file: CONTENT_FILE,
    });

    expect(membership).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-tree -r -z --format=%(objectname) --end-of-options base",
        detail: expect.stringMatching(/\S/),
      },
    });
  });

  it("preserves candidate process failure without attempting a selected-tree query", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValueOnce(ERRORED_ON_BUFFER);

    const membership = gitOver(spawn).contentInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
      file: CONTENT_FILE,
    });

    expect(membership).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo hash-object -- src/example.ts",
        detail: "spawnSync git ENOBUFS",
      },
    });
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("preserves an invalid selected base as GitFailure rather than absent membership", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: `${CANDIDATE_HASH}\n` })
      .mockReturnValueOnce({
        ...EXITED_NOT_A_REPOSITORY,
        stderr: "fatal: not a valid object name missing-base",
      });

    const membership = gitOver(spawn).contentInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "missing-base",
      file: CONTENT_FILE,
    });

    expect(membership).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-tree -r -z --format=%(objectname) --end-of-options missing-base",
        detail: "fatal: not a valid object name missing-base",
      },
    });
    expect(spawn).toHaveBeenCalledTimes(2);
  });
});

describe("createGitPort textInBase", () => {
  it("reads the file's text at the selected revision using option-safe arguments", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "src/example.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "export const example = 1;\n" });

    const reading = gitOver(spawn).textInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "-selected-base",
      file: CONTENT_FILE,
    });

    expect(reading).toEqual({
      outcome: "ok",
      value: { presence: "present-in-base", text: "export const example = 1;\n" },
    });
    expect(spawn.mock.calls).toEqual([
      [
        {
          file: "git",
          arguments: [
            "-C",
            "/repo",
            "ls-tree",
            "-z",
            "--name-only",
            "--end-of-options",
            "-selected-base",
            "src/example.ts",
          ],
          maxBuffer: 268435456,
          environment: { PATH: "/usr/bin", HOME: "/home/someone" },
        },
      ],
      [
        {
          file: "git",
          arguments: [
            "-C",
            "/repo",
            "cat-file",
            "blob",
            "--end-of-options",
            "-selected-base:src/example.ts",
          ],
          maxBuffer: 268435456,
          environment: { PATH: "/usr/bin", HOME: "/home/someone" },
        },
      ],
    ]);
  });

  it("is absent without reading a blob when the selected tree does not list the file", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValueOnce(EXITED_EMPTY);

    const reading = gitOver(spawn).textInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "base",
      file: CONTENT_FILE,
    });

    expect(reading).toEqual({ outcome: "ok", value: { presence: "absent-from-base" } });
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("preserves an invalid selected base as GitFailure rather than absent text", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValueOnce({
      ...EXITED_NOT_A_REPOSITORY,
      stderr: "fatal: not a valid object name missing-base",
    });

    const reading = gitOver(spawn).textInBase({
      repoRoot: REPO_ROOT,
      baseRevision: "missing-base",
      file: CONTENT_FILE,
    });

    expect(reading).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-tree -z --name-only --end-of-options missing-base src/example.ts",
        detail: "fatal: not a valid object name missing-base",
      },
    });
  });
});

describe("createGitPort renamedSince", () => {
  it("diffs the merge base with the worktree, as changedSince does, with rename detection and option-safe arguments", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    const renames = gitOver(spawn).renamedSince({
      repoRoot: REPO_ROOT,
      baseRevision: "-selected-base",
    });

    expect({ renames, calls: spawn.mock.calls }).toEqual({
      renames: { outcome: "ok", value: new Map() },
      calls: [
        [
          {
            file: "git",
            arguments: [
              "-C",
              "/repo",
              "diff",
              "--name-status",
              "-M",
              "-z",
              "--merge-base",
              "--end-of-options",
              "-selected-base",
            ],
            maxBuffer: 268435456,
            environment: { PATH: "/usr/bin", HOME: "/home/someone" },
          },
        ],
      ],
    });
  });

  it("maps each renamed path to its path at the base, unchanged only at a 100 score, passing over every other change", () => {
    const renames = gitOver(
      vi.fn<GitSpawn>().mockReturnValue({
        ...EXITED_EMPTY,
        stdout:
          "M\0src/kept.ts\0R100\0src/old.ts\0src/moved/old.ts\0A\0src/added.ts\0D\0src/gone.ts\0R087\0lib/a.ts\0lib/b.ts\0",
      }),
    ).renamedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(renames).toEqual({
      outcome: "ok",
      value: new Map([
        ["src/moved/old.ts", { basePath: "src/old.ts", content: "unchanged" }],
        ["lib/b.ts", { basePath: "lib/a.ts", content: "edited" }],
      ]),
    });
  });

  it("refuses a rename naming a path that is not a repo path", () => {
    const renames = gitOver(
      vi
        .fn<GitSpawn>()
        .mockReturnValue({ ...EXITED_EMPTY, stdout: "R100\0src/old.ts\0../outside.ts\0" }),
    ).renamedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(renames).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo diff --name-status -M -z --merge-base --end-of-options base",
        detail: "git listed a path that is not a repo path: ../outside.ts",
      },
    });
  });

  it("refuses a rename missing its new path rather than mapping part of it", () => {
    const renames = gitOver(
      vi.fn<GitSpawn>().mockReturnValue({ ...EXITED_EMPTY, stdout: "R100\0src/old.ts\0" }),
    ).renamedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(renames).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo diff --name-status -M -z --merge-base --end-of-options base",
        detail: "git diff did not return a complete NUL-separated name-status listing",
      },
    });
  });

  it("preserves an invalid selected base as GitFailure rather than no renames", () => {
    const renames = gitOver(
      vi.fn<GitSpawn>().mockReturnValue({
        ...EXITED_NOT_A_REPOSITORY,
        stderr: "fatal: bad revision 'missing-base'",
      }),
    ).renamedSince({ repoRoot: REPO_ROOT, baseRevision: "missing-base" });

    expect(renames).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo diff --name-status -M -z --merge-base --end-of-options missing-base",
        detail: "fatal: bad revision 'missing-base'",
      },
    });
  });
});

describe("createGitTreePort pathsAt", () => {
  it("lists every path at the revision with option-safe arguments", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_WITH_LISTING);

    const listing = createGitTreePort({ spawn, ambientEnvironment: AMBIENT_ENVIRONMENT }).pathsAt({
      repoRoot: REPO_ROOT,
      revision: "origin/main",
    });

    expect({ listing, calls: spawn.mock.calls }).toEqual({
      listing: { outcome: "ok", value: ["c.ts", "src/a.ts"] },
      calls: [
        [
          expect.objectContaining({
            arguments: [
              "-C",
              "/repo",
              "ls-tree",
              "-r",
              "-z",
              "--name-only",
              "--end-of-options",
              "origin/main",
            ],
          }),
        ],
      ],
    });
  });

  it("hands git the ambient environment without the repository location", () => {
    const treeSpawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    createGitTreePort({ spawn: treeSpawn, ambientEnvironment: AMBIENT_ENVIRONMENT }).pathsAt({
      repoRoot: REPO_ROOT,
      revision: "HEAD",
    });

    expect(treeSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: expect.not.objectContaining({ [REPOSITORY_LOCATION]: expect.anything() }),
      }),
    );
  });

  it("returns git-failed carrying stderr when git cannot read the revision", () => {
    const listing = createGitTreePort({
      spawn: vi.fn<GitSpawn>().mockReturnValue({
        ...EXITED_NOT_A_REPOSITORY,
        stderr: "fatal: Not a valid object name nope",
      }),
      ambientEnvironment: {},
    }).pathsAt({ repoRoot: REPO_ROOT, revision: "nope" });

    expect(listing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-tree -r -z --name-only --end-of-options nope",
        detail: "fatal: Not a valid object name nope",
      },
    });
  });
});

describe("createGitHistoryPort mergedTags", () => {
  it("lists the tags matching the pattern that are merged into HEAD, one per line", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValue({ ...EXITED_EMPTY, stdout: "v0.1.0-pre.1\nv0.1.0-pre.2\n" });

    const tags = createGitHistoryPort({
      spawn,
      ambientEnvironment: AMBIENT_ENVIRONMENT,
    }).mergedTags({ repoRoot: REPO_ROOT, pattern: "v*" });

    expect(tags).toEqual({ outcome: "ok", value: ["v0.1.0-pre.1", "v0.1.0-pre.2"] });
    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        file: "git",
        arguments: ["-C", "/repo", "tag", "--list", "--merged", "HEAD", "v*"],
      }),
    );
  });

  it("returns git-failed carrying stderr when git exits non-zero", () => {
    const tags = createGitHistoryPort({
      spawn: vi.fn<GitSpawn>().mockReturnValue(EXITED_NOT_A_REPOSITORY),
      ambientEnvironment: AMBIENT_ENVIRONMENT,
    }).mergedTags({
      repoRoot: REPO_ROOT,
      pattern: "v*",
    });

    expect(tags).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo tag --list --merged HEAD v*",
        detail: "fatal: not a git repository",
      },
    });
  });
});

describe("createGitHistoryPort commitsAfter", () => {
  it("lists every commit after the revision up to HEAD, oldest first, with its parent count and its message without trailing newlines", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue({
      ...EXITED_EMPTY,
      stdout:
        "aaa\nfix: one (#1)\n\0aaa bbb\nMerge branch 'main'\n\0ccc\nfeat: two (#2)\n\nBREAKING CHANGE: renamed\n\0",
    });

    const commits = createGitHistoryPort({
      spawn,
      ambientEnvironment: AMBIENT_ENVIRONMENT,
    }).commitsAfter({ repoRoot: REPO_ROOT, revision: "v0.1.0-pre.3" });

    expect(commits).toEqual({
      outcome: "ok",
      value: [
        { parentCount: 1, message: "fix: one (#1)" },
        { parentCount: 2, message: "Merge branch 'main'" },
        { parentCount: 1, message: "feat: two (#2)\n\nBREAKING CHANGE: renamed" },
      ],
    });
    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        file: "git",
        arguments: [
          "-C",
          "/repo",
          "log",
          "--reverse",
          "-z",
          "--format=%P%n%B",
          "--end-of-options",
          "v0.1.0-pre.3..HEAD",
        ],
      }),
    );
  });

  it("counts no parents for a root commit", () => {
    const commits = createGitHistoryPort({
      spawn: vi.fn<GitSpawn>().mockReturnValue({ ...EXITED_EMPTY, stdout: "\nfeat: start\n\0" }),
      ambientEnvironment: AMBIENT_ENVIRONMENT,
    }).commitsAfter({ repoRoot: REPO_ROOT, revision: "v0.1.0-pre.3" });

    expect(commits).toEqual({ outcome: "ok", value: [{ parentCount: 0, message: "feat: start" }] });
  });

  it("lists no commits for empty output", () => {
    const commits = createGitHistoryPort({
      spawn: vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY),
      ambientEnvironment: AMBIENT_ENVIRONMENT,
    }).commitsAfter({
      repoRoot: REPO_ROOT,
      revision: "v0.1.0-pre.3",
    });

    expect(commits).toEqual({ outcome: "ok", value: [] });
  });

  it("returns git-failed with the spawn's detail when git cannot run", () => {
    const commits = createGitHistoryPort({
      spawn: vi.fn<GitSpawn>().mockReturnValue(ERRORED_ON_BUFFER),
      ambientEnvironment: AMBIENT_ENVIRONMENT,
    }).commitsAfter({
      repoRoot: REPO_ROOT,
      revision: "v0.1.0-pre.3",
    });

    expect(commits).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command:
          "git -C /repo log --reverse -z --format=%P%n%B --end-of-options v0.1.0-pre.3..HEAD",
        detail: "spawnSync git ENOBUFS",
      },
    });
  });
});

describe("createEnvironmentOutsideRepository", () => {
  it("keeps every variable except those that name a repository location", () => {
    const ambientEnvironment = {
      GIT_DIR: "/elsewhere/.git",
      GIT_WORK_TREE: "/elsewhere",
      GIT_INDEX_FILE: "/elsewhere/.git/index",
      PATH: "/usr/bin",
      HOME: "/home/someone",
    };

    const environment = createEnvironmentOutsideRepository({ ambientEnvironment });

    expect(environment).toEqual({ PATH: "/usr/bin", HOME: "/home/someone" });
  });
});

describe("createGitExecutionPolicy", () => {
  it("runs git outside any ambient repository, on the index file it is given", () => {
    const policy = createGitExecutionPolicy({ indexFile: "/repo/.git/speed-index" });

    const environment = policy.environment({
      ambient: { GIT_DIR: "/elsewhere/.git", GIT_INDEX_FILE: "/elsewhere/index", PATH: "/usr/bin" },
    });

    expect({ executable: policy.executable, environment }).toEqual({
      executable: "git",
      environment: { PATH: "/usr/bin", GIT_INDEX_FILE: "/repo/.git/speed-index" },
    });
  });
});

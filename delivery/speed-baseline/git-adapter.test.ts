import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import type { ExecutionPort } from "../../src/infrastructure/node/process/execution-port.ts";
import {
  createBaselineCheckoutPort,
  createTargetCopyPort,
  createTargetTreePort,
} from "./git-adapter.ts";

describe("createBaselineCheckoutPort read", () => {
  it("names the revision's checkout after its commit, beside the repository's other worktrees", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValueOnce({
        outcome: "ok",
        value: { status: 0, stdout: "31098fa5\n", stderr: "" },
      })
      .mockReturnValueOnce({
        outcome: "ok",
        value: { status: 0, stdout: "/work/hone/.git\n", stderr: "" },
      });
    const checkouts = createBaselineCheckoutPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      repository: absoluteRootOf("/work/hone/.claude/worktrees/feature"),
    });

    const directory = checkouts.read({ revision: "origin/main" });

    expect({ directory, git: run.mock.calls }).toEqual({
      directory: { outcome: "ok", value: "/work/hone/.claude/worktrees/baseline-31098fa5" },
      git: [
        [
          {
            arguments: ["rev-parse", "--verify", "--short", "origin/main^{commit}"],
            cwd: "/work/hone/.claude/worktrees/feature",
          },
        ],
        [
          {
            arguments: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
            cwd: "/work/hone/.claude/worktrees/feature",
          },
        ],
      ],
    });
  });

  it("carries git's status and output when the revision names no commit", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValueOnce({
      outcome: "ok",
      value: { status: 128, stdout: "", stderr: "fatal: Needed a single revision\n" },
    });
    const checkouts = createBaselineCheckoutPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      repository: absoluteRootOf("/work/hone"),
    });

    const directory = checkouts.read({ revision: "nowhere" });

    expect(directory).toEqual({
      outcome: "failed",
      error: {
        kind: "baseline-unchecked-out",
        command: { kind: "exited", status: 128, output: "fatal: Needed a single revision\n" },
      },
    });
  });
});

describe("createBaselineCheckoutPort write", () => {
  it("adds a detached worktree of the revision", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const checkouts = createBaselineCheckoutPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      repository: absoluteRootOf("/work/hone"),
    });

    const written = checkouts.write({
      revision: "origin/main",
      directory: absoluteRootOf("/work/hone/.claude/worktrees/baseline-31098fa5"),
    });

    expect({ written, git: run.mock.calls }).toEqual({
      written: { outcome: "ok", value: null },
      git: [
        [
          {
            arguments: [
              "worktree",
              "add",
              "--detach",
              "/work/hone/.claude/worktrees/baseline-31098fa5",
              "origin/main",
            ],
            cwd: "/work/hone",
          },
        ],
      ],
    });
  });
});

describe("createBaselineCheckoutPort remove", () => {
  it("removes the worktree through git", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const checkouts = createBaselineCheckoutPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      repository: absoluteRootOf("/work/hone"),
    });

    const removed = checkouts.remove({
      directory: absoluteRootOf("/work/hone/.claude/worktrees/baseline-31098fa5"),
    });

    expect({ removed, git: run.mock.calls }).toEqual({
      removed: { outcome: "ok", value: null },
      git: [
        [
          {
            arguments: [
              "worktree",
              "remove",
              "--force",
              "/work/hone/.claude/worktrees/baseline-31098fa5",
            ],
            cwd: "/work/hone",
          },
        ],
      ],
    });
  });

  it("is done when git refuses a worktree it no longer registers", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValueOnce({
        outcome: "ok",
        value: { status: 128, stdout: "", stderr: "fatal: is not a working tree\n" },
      })
      .mockReturnValueOnce({
        outcome: "ok",
        value: { status: 0, stdout: "worktree /work/hone\nHEAD abc\n", stderr: "" },
      });
    const checkouts = createBaselineCheckoutPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      repository: absoluteRootOf("/work/hone"),
    });

    const removed = checkouts.remove({
      directory: absoluteRootOf("/work/hone/.claude/worktrees/baseline-31098fa5"),
    });

    expect({ removed, git: run.mock.calls }).toEqual({
      removed: { outcome: "ok", value: null },
      git: [
        [
          {
            arguments: [
              "worktree",
              "remove",
              "--force",
              "/work/hone/.claude/worktrees/baseline-31098fa5",
            ],
            cwd: "/work/hone",
          },
        ],
        [{ arguments: ["worktree", "list", "--porcelain"], cwd: "/work/hone" }],
      ],
    });
  });

  it("fails with git's refusal when git still registers the worktree", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValueOnce({
        outcome: "ok",
        value: { status: 128, stdout: "", stderr: "fatal: locked\n" },
      })
      .mockReturnValueOnce({
        outcome: "ok",
        value: {
          status: 0,
          stdout:
            "worktree /work/hone\nHEAD abc\n\nworktree /work/hone/.claude/worktrees/baseline-31098fa5\nHEAD def\ndetached\nlocked\n",
          stderr: "",
        },
      });
    const checkouts = createBaselineCheckoutPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      repository: absoluteRootOf("/work/hone"),
    });

    const removed = checkouts.remove({
      directory: absoluteRootOf("/work/hone/.claude/worktrees/baseline-31098fa5"),
    });

    expect(removed).toEqual({
      outcome: "failed",
      error: {
        kind: "baseline-unremoved",
        directory: "/work/hone/.claude/worktrees/baseline-31098fa5",
        command: { kind: "exited", status: 128, output: "fatal: locked\n" },
      },
    });
  });

  it("fails with git's refusal when the registrations cannot be read", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "ok",
      value: { status: 128, stdout: "", stderr: "fatal: busy\n" },
    });
    const checkouts = createBaselineCheckoutPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      repository: absoluteRootOf("/work/hone"),
    });

    const removed = checkouts.remove({
      directory: absoluteRootOf("/work/hone/.claude/worktrees/baseline-31098fa5"),
    });

    expect(removed).toEqual({
      outcome: "failed",
      error: {
        kind: "baseline-unremoved",
        directory: "/work/hone/.claude/worktrees/baseline-31098fa5",
        command: { kind: "exited", status: 128, output: "fatal: busy\n" },
      },
    });
  });
});

describe("createTargetCopyPort read", () => {
  it("names the side's install beside the target's other worktrees", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "ok",
      value: { status: 0, stdout: "/work/large-repo/.git\n", stderr: "" },
    });
    const copies = createTargetCopyPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const directory = copies.read({
      repo: absoluteRootOf("/work/large-repo"),
      place: { kind: "install", side: "head" },
    });

    expect({ directory, git: run.mock.calls }).toEqual({
      directory: { outcome: "ok", value: "/work/large-repo/.claude/worktrees/hone-speed-head" },
      git: [
        [
          {
            arguments: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
            cwd: "/work/large-repo",
          },
        ],
      ],
    });
  });

  it("carries the launch detail when git cannot start", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "launch-failed",
        detail: "spawn git ENOENT",
        stdout: "",
        stderr: "",
        code: "ENOENT",
        signal: undefined,
      },
    });
    const copies = createTargetCopyPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const directory = copies.read({
      repo: absoluteRootOf("/work/large-repo"),
      place: { kind: "install", side: "baseline" },
    });

    expect(directory).toEqual({
      outcome: "failed",
      error: {
        kind: "target-uncopied",
        command: { kind: "unlaunched", detail: "spawn git ENOENT" },
      },
    });
  });
});

describe("createTargetCopyPort write", () => {
  it("adds a detached worktree of the target's HEAD", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const copies = createTargetCopyPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const written = copies.write({
      repo: absoluteRootOf("/work/large-repo"),
      directory: absoluteRootOf("/work/large-repo/.claude/worktrees/hone-speed-head"),
    });

    expect({ written, git: run.mock.calls }).toEqual({
      written: { outcome: "ok", value: null },
      git: [
        [
          {
            arguments: [
              "worktree",
              "add",
              "--detach",
              "/work/large-repo/.claude/worktrees/hone-speed-head",
              "HEAD",
            ],
            cwd: "/work/large-repo",
          },
        ],
      ],
    });
  });
});

describe("createTargetCopyPort remove", () => {
  it("removes the copy through the target repository", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const copies = createTargetCopyPort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const removed = copies.remove({
      repo: absoluteRootOf("/work/large-repo"),
      directory: absoluteRootOf("/work/large-repo/.claude/worktrees/hone-speed-head"),
    });

    expect({ removed, git: run.mock.calls }).toEqual({
      removed: { outcome: "ok", value: null },
      git: [
        [
          {
            arguments: [
              "worktree",
              "remove",
              "--force",
              "/work/large-repo/.claude/worktrees/hone-speed-head",
            ],
            cwd: "/work/large-repo",
          },
        ],
      ],
    });
  });
});

describe("createTargetTreePort read", () => {
  it("writes the target's working state into the temporary index and reads back the tree", () => {
    const indexRun = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValueOnce({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } })
      .mockReturnValueOnce({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } })
      .mockReturnValueOnce({
        outcome: "ok",
        value: { status: 0, stdout: "4b825dc6\n", stderr: "" },
      });
    const createGit = vi
      .fn<(request: { readonly indexFile?: string }) => ExecutionPort<"captured", "none">>()
      .mockReturnValue({ run: indexRun });
    const trees = createTargetTreePort({
      git: { run: vi.fn<ExecutionPort<"captured", "none">["run"]>() },
      createGit,
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    });

    const tree = trees.read({
      repo: absoluteRootOf("/work/large-repo"),
      indexDirectory: absoluteRootOf("/tmp/hone-w12"),
    });

    expect({ tree, index: createGit.mock.calls, indexGit: indexRun.mock.calls }).toEqual({
      tree: { outcome: "ok", value: "4b825dc6" },
      index: [
        [
          {
            indexFile: "/tmp/hone-w12/index",
          },
        ],
      ],
      indexGit: [
        [
          {
            arguments: ["-c", "core.splitIndex=false", "read-tree", "HEAD"],
            cwd: "/work/large-repo",
          },
        ],
        [{ arguments: ["-c", "core.splitIndex=false", "add", "--all"], cwd: "/work/large-repo" }],
        [{ arguments: ["-c", "core.splitIndex=false", "write-tree"], cwd: "/work/large-repo" }],
      ],
    });
  });
});

describe("createTargetTreePort write", () => {
  it("writes the tree into the copy's index and files", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const trees = createTargetTreePort({
      git: { run },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      createGit:
        vi.fn<(request: { readonly indexFile?: string }) => ExecutionPort<"captured", "none">>(),
    });

    const written = trees.write({ copy: absoluteRootOf("/work/copy"), tree: "4b825dc6" });

    expect({ written, git: run.mock.calls }).toEqual({
      written: { outcome: "ok", value: null },
      git: [[{ arguments: ["read-tree", "-u", "--reset", "4b825dc6"], cwd: "/work/copy" }]],
    });
  });
});

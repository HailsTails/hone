import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { ExecutionPort } from "../../src/infrastructure/node/process/execution-port.ts";
import { createBunTargetInstallPort } from "./bun-adapter.ts";

describe("createBunTargetInstallPort write", () => {
  it("installs the frozen lockfile, then adds the tarball as a development dependency, preferring the local store", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const installers = createBunTargetInstallPort({ bun: { run } });

    const written = installers.write({
      directory: absoluteRootOf("/work/large-repo/.claude/worktrees/hone-speed-head"),
      tarball: absoluteRootOf("/work/hone/hone-2.0.0.tgz"),
    });

    expect({ written, bun: run.mock.calls }).toEqual({
      written: { outcome: "ok", value: null },
      bun: [
        [
          {
            arguments: ["install", "--frozen-lockfile", "--prefer-offline"],
            cwd: "/work/large-repo/.claude/worktrees/hone-speed-head",
          },
        ],
        [
          {
            arguments: ["add", "--dev", "--prefer-offline", "/work/hone/hone-2.0.0.tgz"],
            cwd: "/work/large-repo/.claude/worktrees/hone-speed-head",
          },
        ],
      ],
    });
  });

  it("adds nothing, and carries bun's status and output, when the frozen install fails", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "ok",
      value: { status: 1, stdout: "", stderr: "error: not in the cache\n" },
    });
    const installers = createBunTargetInstallPort({ bun: { run } });

    const written = installers.write({
      directory: absoluteRootOf("/work/large-repo"),
      tarball: absoluteRootOf("/work/hone/hone-2.0.0.tgz"),
    });

    expect(written).toEqual({
      outcome: "failed",
      error: {
        kind: "hone-uninstalled",
        command: { kind: "exited", status: 1, output: "error: not in the cache\n" },
      },
    });
  });
});

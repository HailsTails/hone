import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../../node/path-port.ts";
import type { ExecutionPort } from "../../../node/process/execution-port.ts";
import { createChildEnginesStage } from "./child-measurement.ts";

describe("createChildEnginesStage", () => {
  it("runs the measurement entry over the roots and decodes the reply pipe", async () => {
    const execution: ExecutionPort<"passed-through", "opened"> = {
      run: vi.fn<ExecutionPort<"passed-through", "opened">["run"]>().mockReturnValue({
        outcome: "ok",
        value: {
          status: 0,
          stderr: "",
          reply: '{"outcome":"not-loaded","failure":{"kind":"config-absent","repo":"/repo"}}',
        },
      }),
    };
    const engines = createChildEnginesStage({
      execution,
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
      installRoot: absoluteRootOf("/install"),
      repoRoot: absoluteRootOf("/repo"),
      moduleExtension: ".js",
      baseRevision: "origin/main",
    });

    const runs = await engines();

    expect(runs).toEqual({ outcome: "failed", error: { kind: "config-absent", repo: "/repo" } });
    expect(execution.run).toHaveBeenCalledExactlyOnceWith({
      arguments: ["/install/src/measure-engines.process.js", "/install", "/repo", "origin/main"],
    });
  });

  it("fails as an unexpected error when the child does not finish", async () => {
    const execution: ExecutionPort<"passed-through", "opened"> = {
      run: vi.fn<ExecutionPort<"passed-through", "opened">["run"]>().mockReturnValue({
        outcome: "failed",
        error: {
          kind: "launch-failed",
          detail: "spawn ENOENT",
          stdout: "",
          stderr: "",
          code: "ENOENT",
          signal: undefined,
        },
      }),
    };
    const engines = createChildEnginesStage({
      execution,
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
      installRoot: absoluteRootOf("/install"),
      repoRoot: absoluteRootOf("/repo"),
      moduleExtension: ".ts",
      baseRevision: undefined,
    });

    const runs = await engines();

    expect(runs).toEqual({
      outcome: "failed",
      error: {
        kind: "unexpected-error",
        detail: "the measurement process did not finish: spawn ENOENT",
      },
    });
  });
});

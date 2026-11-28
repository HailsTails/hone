import { describe, expect, it, vi } from "vitest";

import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { ExecutionPort } from "../../src/infrastructure/node/process/execution-port.ts";
import { createHoneCheckPort } from "./node-adapter.ts";

describe("createHoneCheckPort run", () => {
  it("checks the copy against the base revision in the sample's temporary folder, with the CPU-time writer preloaded, and reads the CPU time it wrote", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "ok",
      value: {
        status: 1,
        stdout: "findings\n",
        stderr: "\nhone-speed-baseline-cpu-time-microseconds 32530000\n",
      },
    });
    const createExecution = vi
      .fn<
        (request: { readonly temporaryFolder: AbsolutePath }) => ExecutionPort<"captured", "none">
      >()
      .mockReturnValue({ run });
    const checks = createHoneCheckPort({
      createExecution,
      cpuTimeReportUrl: "file:///work/hone/cpu-time-report.ts",
    });

    const measured = checks.run({
      command: absoluteRootOf("/work/copy/node_modules/@hailstails/hone/src/hone.js"),
      repo: absoluteRootOf("/work/copy"),
      baseRevision: "a4af1c897",
      temporaryFolder: absoluteRootOf("/work/copy/.hone-speed-temporary"),
    });

    expect({ measured, created: createExecution.mock.calls, node: run.mock.calls }).toEqual({
      measured: { outcome: "ok", value: 32_530_000 },
      created: [[{ temporaryFolder: "/work/copy/.hone-speed-temporary" }]],
      node: [
        [
          {
            arguments: [
              "--import",
              "file:///work/hone/cpu-time-report.ts",
              "/work/copy/node_modules/@hailstails/hone/src/hone.js",
              "check",
              "--repo",
              "/work/copy",
              "--base-revision",
              "a4af1c897",
            ],
            cwd: "/work/copy",
          },
        ],
      ],
    });
  });

  it("carries the status and the check's own output when it exits with neither verdict", () => {
    const run = vi.fn<ExecutionPort<"captured", "none">["run"]>().mockReturnValue({
      outcome: "ok",
      value: {
        status: 2,
        stdout: "",
        stderr: "config refused\n\nhone-speed-baseline-cpu-time-microseconds 100\n",
      },
    });
    const checks = createHoneCheckPort({
      createExecution: vi
        .fn<
          (request: { readonly temporaryFolder: AbsolutePath }) => ExecutionPort<"captured", "none">
        >()
        .mockReturnValue({ run }),
      cpuTimeReportUrl: "file:///work/hone/cpu-time-report.ts",
    });

    const measured = checks.run({
      command: absoluteRootOf("/work/hone.js"),
      repo: absoluteRootOf("/work/copy"),
      baseRevision: "a4af1c897",
      temporaryFolder: absoluteRootOf("/work/copy/.hone-speed-temporary"),
    });

    expect(measured).toEqual({
      outcome: "failed",
      error: { kind: "check-exited", status: 2, output: "config refused" },
    });
  });

  it("names the missing CPU time when the check printed none", () => {
    const run = vi
      .fn<ExecutionPort<"captured", "none">["run"]>()
      .mockReturnValue({ outcome: "ok", value: { status: 0, stdout: "", stderr: "" } });
    const checks = createHoneCheckPort({
      createExecution: vi
        .fn<
          (request: { readonly temporaryFolder: AbsolutePath }) => ExecutionPort<"captured", "none">
        >()
        .mockReturnValue({ run }),
      cpuTimeReportUrl: "file:///work/hone/cpu-time-report.ts",
    });

    const measured = checks.run({
      command: absoluteRootOf("/work/hone.js"),
      repo: absoluteRootOf("/work/copy"),
      baseRevision: "a4af1c897",
      temporaryFolder: absoluteRootOf("/work/copy/.hone-speed-temporary"),
    });

    expect(measured).toEqual({ outcome: "failed", error: { kind: "cpu-time-missing" } });
  });
});

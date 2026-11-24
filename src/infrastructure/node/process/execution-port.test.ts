import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import {
  createExecutionPort,
  createExecutionSpawn,
  type ExecutionPolicy,
  type ExecutionSpawn,
  type ExecutionSpawnProvider,
} from "./execution-port.ts";

const WORKING_DIRECTORY = absoluteRootOf("D:\\work\\project files");

describe("createExecutionPort", () => {
  it("binds policy and environment once and snapshots inputs across direct argv runs", () => {
    const ambientEnvironment = { PATH: "original search path", UNUSED: undefined };
    const childEnvironment = { PATH: "child search path", MODE: "isolated" };
    const environment = vi
      .fn<ExecutionPolicy<"passed-through", "opened">["environment"]>()
      .mockReturnValue(childEnvironment);
    const policy = {
      executable: "node",
      environment,
      timeoutMilliseconds: 60000,
      maximumOutputBytes: 16777216,
      stdout: "passed-through",
      replyPipe: "opened",
    } satisfies ExecutionPolicy<"passed-through", "opened">;
    const spawn = vi.fn<ExecutionSpawn<"passed-through", "opened">>().mockReturnValue({
      outcome: "ok",
      value: { status: 7, stderr: "warnings", reply: "measured" },
    });
    const execution = createExecutionPort({ spawn, policy, ambientEnvironment });
    const commandArguments = ["tool entry.mjs", "--label=a & b"];

    const first = execution.run({ arguments: commandArguments, cwd: WORKING_DIRECTORY });
    Object.assign(ambientEnvironment, { PATH: "changed ambient" });
    Object.assign(childEnvironment, { PATH: "changed child" });
    Object.assign(policy, { executable: "other", timeoutMilliseconds: 1, maximumOutputBytes: 1 });
    Object.assign(commandArguments, { 0: "changed argument" });
    const second = execution.run({ arguments: ["second.mjs"] });

    expect(first).toEqual({
      outcome: "ok",
      value: { status: 7, stderr: "warnings", reply: "measured" },
    });
    expect(second).toEqual(first);
    expect(environment).toHaveBeenCalledExactlyOnceWith({
      ambient: { PATH: "original search path", UNUSED: undefined },
    });
    expect(spawn).toHaveBeenNthCalledWith(1, {
      executable: "node",
      arguments: ["tool entry.mjs", "--label=a & b"],
      cwd: WORKING_DIRECTORY,
      environment: { PATH: "child search path", MODE: "isolated" },
      timeoutMilliseconds: 60000,
      maximumOutputBytes: 16777216,
      stdout: "passed-through",
      replyPipe: "opened",
    });
    expect(spawn).toHaveBeenNthCalledWith(2, {
      executable: "node",
      arguments: ["second.mjs"],
      environment: { PATH: "child search path", MODE: "isolated" },
      timeoutMilliseconds: 60000,
      maximumOutputBytes: 16777216,
      stdout: "passed-through",
      replyPipe: "opened",
    });
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it.each([
    { executable: "", timeoutMilliseconds: undefined, maximumOutputBytes: 1024 },
    { executable: "node", timeoutMilliseconds: undefined, maximumOutputBytes: 0 },
    { executable: "node", timeoutMilliseconds: undefined, maximumOutputBytes: 1.5 },
    { executable: "node", timeoutMilliseconds: 0, maximumOutputBytes: 1024 },
    { executable: "node", timeoutMilliseconds: 1.5, maximumOutputBytes: 1024 },
  ])("refuses invalid fixed policy before any spawn: %j", (invalidPolicy) => {
    const environment = vi
      .fn<ExecutionPolicy<"captured", "none">["environment"]>()
      .mockReturnValue({});
    const spawn = vi.fn<ExecutionSpawn<"captured", "none">>();
    const execution = createExecutionPort({
      spawn,
      policy: { ...invalidPolicy, environment, stdout: "captured", replyPipe: "none" },
      ambientEnvironment: {},
    });

    expect(execution.run({ arguments: [] })).toEqual({
      outcome: "failed",
      error: expect.objectContaining({
        kind: "policy-invalid",
        stdout: "",
        stderr: "",
        code: undefined,
        signal: undefined,
      }),
    });
    expect(execution.run({ arguments: ["later"] })).toEqual({
      outcome: "failed",
      error: expect.objectContaining({ kind: "policy-invalid" }),
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("retains a construction-time environment binding failure across runs without spawning", () => {
    const policy: ExecutionPolicy<"captured", "none"> = {
      executable: "node",
      environment: () => expect.fail("environment binding failed"),
      timeoutMilliseconds: undefined,
      maximumOutputBytes: 1024,
      stdout: "captured",
      replyPipe: "none",
    };
    const environment = vi.spyOn(policy, "environment");
    const spawn = vi.fn<ExecutionSpawn<"captured", "none">>().mockReturnValue({
      outcome: "ok",
      value: { status: 0, stdout: "", stderr: "" },
    });
    const execution = createExecutionPort({
      spawn,
      policy,
      ambientEnvironment: { PATH: "fixture path" },
    });
    const constructionCalls = environment.mock.calls.length;

    const first = execution.run({ arguments: ["first"] });
    const second = execution.run({ arguments: ["second"], cwd: WORKING_DIRECTORY });

    expect(first).toEqual({
      outcome: "failed",
      error: {
        kind: "policy-invalid",
        detail: expect.stringContaining("environment binding failed"),
        stdout: "",
        stderr: "",
        code: undefined,
        signal: undefined,
      },
    });
    expect(second).toEqual(first);
    expect(constructionCalls).toBe(1);
    expect(environment).toHaveBeenCalledExactlyOnceWith({ ambient: { PATH: "fixture path" } });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("preserves a classified spawn failure and allows a policy without a timeout", () => {
    const failure = {
      outcome: "failed",
      error: {
        kind: "output-limit-exceeded",
        detail: "output limit reached",
        stdout: "partial diagnostics",
        stderr: "partial warnings",
        code: "ENOBUFS",
        signal: "SIGKILL",
      },
    } satisfies ReturnType<ExecutionSpawn<"captured", "none">>;
    const spawn = vi.fn<ExecutionSpawn<"captured", "none">>().mockReturnValue(failure);

    const executionOutcome = createExecutionPort({
      spawn,
      policy: {
        executable: "git",
        environment: vi
          .fn<ExecutionPolicy<"captured", "none">["environment"]>()
          .mockReturnValue({}),
        timeoutMilliseconds: undefined,
        maximumOutputBytes: 268435456,
        stdout: "captured",
        replyPipe: "none",
      },
      ambientEnvironment: {},
    }).run({ arguments: ["status", "--porcelain"] });

    expect(executionOutcome).toEqual(failure);
    expect(spawn).toHaveBeenCalledExactlyOnceWith({
      executable: "git",
      arguments: ["status", "--porcelain"],
      environment: {},
      timeoutMilliseconds: undefined,
      maximumOutputBytes: 268435456,
      stdout: "captured",
      replyPipe: "none",
    });
  });
});

describe("createExecutionSpawn", () => {
  it("maps direct argv and native cwd into UTF8 bounded hidden execution while preserving an ordinary nonzero exit", () => {
    const spawnProvider = vi.fn<ExecutionSpawnProvider>().mockReturnValue({
      pid: 42,
      output: [null, "diagnostics λ", "warnings"],
      stdout: "diagnostics λ",
      stderr: "warnings",
      status: 2,
      signal: null,
    });

    const spawnOutcome = createExecutionSpawn({ spawnProvider })({
      executable: "node",
      arguments: ["tool entry.mjs", "--label=a & b"],
      cwd: WORKING_DIRECTORY,
      environment: { PATH: "child path", OPTIONAL: undefined },
      timeoutMilliseconds: 60000,
      maximumOutputBytes: 16777216,
      stdout: "captured",
      replyPipe: "none",
    });

    expect(spawnOutcome).toEqual({
      outcome: "ok",
      value: { status: 2, stdout: "diagnostics λ", stderr: "warnings" },
    });
    expect(spawnProvider).toHaveBeenCalledExactlyOnceWith({
      command: "node",
      commandArguments: ["tool entry.mjs", "--label=a & b"],
      options: expect.objectContaining({
        encoding: "utf8",
        cwd: WORKING_DIRECTORY,
        env: { PATH: "child path", OPTIONAL: undefined },
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60000,
        killSignal: "SIGKILL",
        maxBuffer: 16777216,
      }),
    });
    expect(spawnProvider).not.toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ shell: true }) }),
    );
    expect(spawnProvider).not.toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ detached: true }) }),
    );
  });

  it("passes output through and reads the reply from its own pipe when the policy opens one", () => {
    const spawnProvider = vi.fn<ExecutionSpawnProvider>().mockReturnValue({
      pid: 42,
      output: [null, null, "warnings", '{"outcome":"measured","runs":[]}'],
      stdout: "",
      stderr: "warnings",
      status: 0,
      signal: null,
    });

    const spawnOutcome = createExecutionSpawn({ spawnProvider })({
      executable: "node",
      arguments: ["measure.mjs"],
      environment: {},
      timeoutMilliseconds: undefined,
      maximumOutputBytes: 1024,
      stdout: "passed-through",
      replyPipe: "opened",
    });

    expect(spawnOutcome).toEqual({
      outcome: "ok",
      value: {
        status: 0,
        stderr: "warnings",
        reply: '{"outcome":"measured","runs":[]}',
      },
    });
    expect(spawnProvider).toHaveBeenCalledExactlyOnceWith({
      command: "node",
      commandArguments: ["measure.mjs"],
      options: {
        encoding: "utf8",
        env: {},
        stdio: ["pipe", "inherit", "pipe", "pipe"],
        windowsHide: true,
        timeout: undefined,
        killSignal: "SIGKILL",
        maxBuffer: 1024,
      },
    });
  });

  it("fails as a host failure when the policy opens a reply pipe the process left unreadable", () => {
    const spawnProvider = vi.fn<ExecutionSpawnProvider>().mockReturnValue({
      pid: 42,
      output: [null, null, "warnings", null],
      stdout: "",
      stderr: "warnings",
      status: 0,
      signal: null,
    });

    const spawnOutcome = createExecutionSpawn({ spawnProvider })({
      executable: "node",
      arguments: ["measure.mjs"],
      environment: {},
      timeoutMilliseconds: undefined,
      maximumOutputBytes: 1024,
      stdout: "passed-through",
      replyPipe: "opened",
    });

    expect(spawnOutcome).toEqual({
      outcome: "failed",
      error: {
        kind: "host-failed",
        detail: "the process exited without a readable reply pipe",
        stdout: "",
        stderr: "warnings",
        code: undefined,
        signal: undefined,
      },
    });
  });

  it.each([
    { code: "ETIMEDOUT", kind: "timed-out" },
    { code: "ENOBUFS", kind: "output-limit-exceeded" },
    { code: "ENOENT", kind: "launch-failed" },
  ])(
    "classifies native $code before a simultaneous signal and retains available diagnostics",
    ({ code, kind }) => {
      const spawnProvider = vi.fn<ExecutionSpawnProvider>().mockReturnValue({
        pid: 42,
        output: [null, "partial out", "partial err"],
        stdout: "partial out",
        stderr: "partial err",
        status: null,
        signal: "SIGTERM",
        error: Object.assign(new Error("native launch detail"), { code }),
      });

      expect(
        createExecutionSpawn({ spawnProvider })({
          executable: "node",
          arguments: ["tool.mjs"],
          environment: {},
          timeoutMilliseconds: undefined,
          maximumOutputBytes: 1024,
          stdout: "captured",
          replyPipe: "none",
        }),
      ).toEqual({
        outcome: "failed",
        error: {
          kind,
          detail: expect.stringContaining("native launch detail"),
          stdout: "partial out",
          stderr: "partial err",
          code,
          signal: "SIGTERM",
        },
      });
    },
  );

  it("reports a signalled null exit as terminated with retained output", () => {
    const spawnProvider = vi.fn<ExecutionSpawnProvider>().mockReturnValue({
      pid: 42,
      output: [null, "unfinished", "signal detail"],
      stdout: "unfinished",
      stderr: "signal detail",
      status: null,
      signal: "SIGKILL",
    });

    expect(
      createExecutionSpawn({ spawnProvider })({
        executable: "node",
        arguments: [],
        environment: {},
        timeoutMilliseconds: undefined,
        maximumOutputBytes: 1024,
        stdout: "captured",
        replyPipe: "none",
      }),
    ).toEqual({
      outcome: "failed",
      error: expect.objectContaining({
        kind: "terminated",
        stdout: "unfinished",
        stderr: "signal detail",
        code: undefined,
        signal: "SIGKILL",
      }),
    });
  });

  it("refuses an unexplained null status rather than certifying an ordinary exit", () => {
    const spawnProvider = vi.fn<ExecutionSpawnProvider>().mockReturnValue({
      pid: 42,
      output: [null, "unfinished", ""],
      stdout: "unfinished",
      stderr: "",
      status: null,
      signal: null,
    });

    expect(
      createExecutionSpawn({ spawnProvider })({
        executable: "node",
        arguments: [],
        environment: {},
        timeoutMilliseconds: undefined,
        maximumOutputBytes: 1024,
        stdout: "captured",
        replyPipe: "none",
      }),
    ).toEqual({
      outcome: "failed",
      error: expect.objectContaining({
        kind: "host-failed",
        stdout: "unfinished",
        stderr: "",
        code: undefined,
        signal: undefined,
      }),
    });
  });

  it("preserves available output, code and signal from a caught external host failure", () => {
    const spawnProvider = vi.fn<ExecutionSpawnProvider>().mockThrow(
      Object.assign(new Error("host failure"), {
        stdout: "caught out",
        stderr: "caught err",
        code: "EHOST",
        signal: "SIGTERM",
      }),
    );

    expect(
      createExecutionSpawn({ spawnProvider })({
        executable: "node",
        arguments: [],
        environment: {},
        timeoutMilliseconds: undefined,
        maximumOutputBytes: 1024,
        stdout: "captured",
        replyPipe: "none",
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "host-failed",
        detail: expect.stringContaining("host failure"),
        stdout: "caught out",
        stderr: "caught err",
        code: "EHOST",
        signal: "SIGTERM",
      },
    });
  });
});

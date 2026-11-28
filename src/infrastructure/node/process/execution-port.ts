import {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
  type StdioOptions,
  spawnSync,
} from "node:child_process";

import { z } from "zod";

import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { openReplyPipe, readReplyPipe } from "./reply-pipe.ts";

export type ExecutionEnvironment = Readonly<Record<string, string | undefined>>;

export type ExecutionStdout = "captured" | "passed-through";

export type ExecutionReplyPipe = "none" | "opened";

type NoChannelOutput = Readonly<Record<never, never>>;

type StdoutExit<Stdout extends ExecutionStdout> = Stdout extends "captured"
  ? { readonly stdout: string }
  : NoChannelOutput;

type ReplyExit<ReplyPipe extends ExecutionReplyPipe> = ReplyPipe extends "opened"
  ? { readonly reply: string }
  : NoChannelOutput;

export type ExecutionExit<Stdout extends ExecutionStdout, ReplyPipe extends ExecutionReplyPipe> = {
  readonly status: number;
  readonly stderr: string;
} & StdoutExit<Stdout> &
  ReplyExit<ReplyPipe>;

export type ExecutionFailure = {
  readonly kind:
    | "policy-invalid"
    | "launch-failed"
    | "timed-out"
    | "output-limit-exceeded"
    | "terminated"
    | "host-failed";
  readonly detail: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly code: string | undefined;
  readonly signal: string | undefined;
};

export type ExecutionRequest = {
  readonly arguments: readonly string[];
  readonly cwd?: AbsolutePath;
  readonly input?: string;
};

export type ExecutionPort<Stdout extends ExecutionStdout, ReplyPipe extends ExecutionReplyPipe> = {
  readonly run: (
    request: ExecutionRequest,
  ) => Result<ExecutionExit<Stdout, ReplyPipe>, ExecutionFailure>;
};

export type ExecutionPolicy<
  Stdout extends ExecutionStdout,
  ReplyPipe extends ExecutionReplyPipe,
> = {
  readonly executable: string;
  readonly environment: (request: {
    readonly ambient: ExecutionEnvironment;
  }) => ExecutionEnvironment;
  readonly timeoutMilliseconds: number | undefined;
  readonly maximumOutputBytes: number;
  readonly stdout: Stdout;
  readonly replyPipe: ReplyPipe;
};

type ExecutionSpawnRequest<Stdout extends ExecutionStdout, ReplyPipe extends ExecutionReplyPipe> = {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly cwd?: AbsolutePath;
  readonly input?: string;
  readonly environment: ExecutionEnvironment;
  readonly timeoutMilliseconds: number | undefined;
  readonly maximumOutputBytes: number;
  readonly stdout: Stdout;
  readonly replyPipe: ReplyPipe;
};

export type ExecutionSpawn<Stdout extends ExecutionStdout, ReplyPipe extends ExecutionReplyPipe> = (
  request: ExecutionSpawnRequest<Stdout, ReplyPipe>,
) => Result<ExecutionExit<Stdout, ReplyPipe>, ExecutionFailure>;

export type ExecutionSpawner = <
  Stdout extends ExecutionStdout,
  ReplyPipe extends ExecutionReplyPipe,
>(
  request: ExecutionSpawnRequest<Stdout, ReplyPipe>,
) => Result<ExecutionExit<Stdout, ReplyPipe>, ExecutionFailure>;

export type ExecutionSpawnProvider = (request: {
  readonly command: string;
  readonly commandArguments: readonly string[];
  readonly options: SpawnSyncOptionsWithStringEncoding;
}) => SpawnSyncReturns<string>;

const executionEnvironmentSchema = z.record(z.string(), z.string().optional()).readonly();
const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const policySchema = z
  .object({
    executable: z.string().min(1),
    environment: executionEnvironmentSchema,
    timeoutMilliseconds: positiveSafeIntegerSchema.optional(),
    maximumOutputBytes: positiveSafeIntegerSchema,
  })
  .readonly();

const hostDiagnosticsSchema = z.object({
  stdout: z.string().catch(""),
  stderr: z.string().catch(""),
  code: z.string().optional().catch(undefined),
  signal: z.string().optional().catch(undefined),
});

const EMPTY_DIAGNOSTICS = { stdout: "", stderr: "", code: undefined, signal: undefined };

const failedExecution = (
  error: ExecutionFailure,
): {
  readonly outcome: "failed";
  readonly error: ExecutionFailure;
} => ({ outcome: "failed", error });

const failureDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const launchFailureKind = (request: {
  readonly code: string | undefined;
}): ExecutionFailure["kind"] => {
  if (request.code === "ETIMEDOUT") return "timed-out";
  if (request.code === "ENOBUFS") return "output-limit-exceeded";
  return "launch-failed";
};

type ExecutionDiagnostics = Pick<ExecutionFailure, "stdout" | "stderr" | "code" | "signal">;

type ChannelReading = {
  readonly spawned: SpawnSyncReturns<string>;
  readonly diagnostics: ExecutionDiagnostics;
};

const STDOUT_READERS: {
  readonly [Stdout in ExecutionStdout]: (
    request: ChannelReading,
  ) => Result<StdoutExit<Stdout>, ExecutionFailure>;
} = {
  captured: (request) => ({ outcome: "ok", value: { stdout: request.diagnostics.stdout } }),
  "passed-through": () => ({ outcome: "ok", value: {} }),
};

const REPLY_READERS: {
  readonly [ReplyPipe in ExecutionReplyPipe]: (
    request: ChannelReading,
  ) => Result<ReplyExit<ReplyPipe>, ExecutionFailure>;
} = {
  none: () => ({ outcome: "ok", value: {} }),
  opened: (request) => {
    const reply = readReplyPipe({ output: request.spawned.output });
    return reply !== undefined
      ? { outcome: "ok", value: { reply } }
      : failedExecution({
          ...request.diagnostics,
          kind: "host-failed",
          detail: "the process exited without a readable reply pipe",
        });
  },
};

const nativeOutcome = <
  Stdout extends ExecutionStdout,
  ReplyPipe extends ExecutionReplyPipe,
>(request: {
  readonly spawned: SpawnSyncReturns<string>;
  readonly stdout: Stdout;
  readonly replyPipe: ReplyPipe;
}): Result<ExecutionExit<Stdout, ReplyPipe>, ExecutionFailure> => {
  const { spawned } = request;
  const launchError: NodeJS.ErrnoException | undefined = spawned.error;
  const diagnostics = {
    stdout: typeof spawned.stdout === "string" ? spawned.stdout : "",
    stderr: typeof spawned.stderr === "string" ? spawned.stderr : "",
    code: launchError?.code,
    signal: spawned.signal ?? undefined,
  };
  if (launchError !== undefined) {
    return failedExecution({
      ...diagnostics,
      kind: launchFailureKind({ code: launchError.code }),
      detail: launchError.message,
    });
  }
  if (spawned.status === null) {
    return failedExecution({
      ...diagnostics,
      kind: spawned.signal === null ? "host-failed" : "terminated",
      detail:
        spawned.signal === null
          ? "the process reported no exit status or signal"
          : `the process was ended by signal ${spawned.signal}`,
    });
  }
  const reading = { spawned, diagnostics };
  const stdout = STDOUT_READERS[request.stdout](reading);
  if (stdout.outcome === "failed") return stdout;
  const reply = REPLY_READERS[request.replyPipe](reading);
  if (reply.outcome === "failed") return reply;
  return {
    outcome: "ok",
    value: { status: spawned.status, stderr: diagnostics.stderr, ...stdout.value, ...reply.value },
  };
};

const createStdio = (request: {
  readonly stdout: ExecutionStdout;
  readonly replyPipe: ExecutionReplyPipe;
}): StdioOptions => {
  const stdout = request.stdout === "captured" ? "pipe" : "inherit";
  const standardStreams = ["pipe", stdout, "pipe"] as const;
  return request.replyPipe === "opened" ? openReplyPipe({ standardStreams }) : [...standardStreams];
};

export const createExecutionSpawn =
  (options: { readonly spawnProvider: ExecutionSpawnProvider }): ExecutionSpawner =>
  (request) => {
    try {
      return nativeOutcome({
        spawned: options.spawnProvider({
          command: request.executable,
          commandArguments: request.arguments,
          options: {
            encoding: "utf8",
            ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
            ...(request.input === undefined ? {} : { input: request.input }),
            env: request.environment,
            stdio: createStdio(request),
            windowsHide: true,
            timeout: request.timeoutMilliseconds,
            killSignal: "SIGKILL",
            maxBuffer: request.maximumOutputBytes,
          },
        }),
        stdout: request.stdout,
        replyPipe: request.replyPipe,
      });
    } catch (thrown) {
      const parsedDiagnostics = hostDiagnosticsSchema.safeParse(thrown);
      const diagnostics = parsedDiagnostics.success ? parsedDiagnostics.data : EMPTY_DIAGNOSTICS;
      return failedExecution({
        stdout: diagnostics.stdout,
        stderr: diagnostics.stderr,
        code: diagnostics.code,
        signal: diagnostics.signal,
        kind: "host-failed",
        detail: failureDetail({ thrown }),
      });
    }
  };

type BoundPolicy<Stdout extends ExecutionStdout, ReplyPipe extends ExecutionReplyPipe> = Omit<
  ExecutionSpawnRequest<Stdout, ReplyPipe>,
  "arguments" | "cwd" | "input" | "timeoutMilliseconds"
> & { readonly timeoutMilliseconds?: number };

const bindPolicy = <Stdout extends ExecutionStdout, ReplyPipe extends ExecutionReplyPipe>(options: {
  readonly policy: ExecutionPolicy<Stdout, ReplyPipe>;
  readonly ambientEnvironment: ExecutionEnvironment;
}): Result<BoundPolicy<Stdout, ReplyPipe>, ExecutionFailure> => {
  try {
    const parsedAmbient = executionEnvironmentSchema.safeParse(options.ambientEnvironment);
    if (!parsedAmbient.success) {
      return failedExecution({
        ...EMPTY_DIAGNOSTICS,
        kind: "policy-invalid",
        detail: z.prettifyError(parsedAmbient.error),
      });
    }
    const { executable, environment, timeoutMilliseconds, maximumOutputBytes, stdout, replyPipe } =
      options.policy;
    const parsedPolicy = policySchema.safeParse({
      executable,
      environment: environment({ ambient: parsedAmbient.data }),
      timeoutMilliseconds,
      maximumOutputBytes,
    });
    return parsedPolicy.success
      ? {
          outcome: "ok",
          value: { ...parsedPolicy.data, stdout, replyPipe },
        }
      : failedExecution({
          ...EMPTY_DIAGNOSTICS,
          kind: "policy-invalid",
          detail: z.prettifyError(parsedPolicy.error),
        });
  } catch (thrown) {
    return failedExecution({
      ...EMPTY_DIAGNOSTICS,
      kind: "policy-invalid",
      detail: failureDetail({ thrown }),
    });
  }
};

export const createExecutionPort = <
  Stdout extends ExecutionStdout,
  ReplyPipe extends ExecutionReplyPipe,
>(options: {
  readonly spawn: ExecutionSpawn<Stdout, ReplyPipe>;
  readonly policy: ExecutionPolicy<Stdout, ReplyPipe>;
  readonly ambientEnvironment: ExecutionEnvironment;
}): ExecutionPort<Stdout, ReplyPipe> => {
  const bound = bindPolicy(options);
  return {
    run: (request) =>
      bound.outcome === "failed"
        ? bound
        : options.spawn({
            ...bound.value,
            timeoutMilliseconds: bound.value.timeoutMilliseconds,
            arguments: [...request.arguments],
            ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
            ...(request.input === undefined ? {} : { input: request.input }),
          }),
  };
};

export const createDefaultExecutionPort = <
  Stdout extends ExecutionStdout,
  ReplyPipe extends ExecutionReplyPipe,
>(options: {
  readonly policy: ExecutionPolicy<Stdout, ReplyPipe>;
}): ExecutionPort<Stdout, ReplyPipe> =>
  createExecutionPort({
    spawn: createExecutionSpawn({
      spawnProvider: (request) =>
        spawnSync(request.command, [...request.commandArguments], request.options),
    }),
    policy: options.policy,
    ambientEnvironment: { ...process.env },
  });

import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { UpgradeFailure } from "../application/ports/upgrade/upgrade-stop.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { Result } from "../domain/result.ts";
import { parseInvocation } from "../infrastructure/command-line/arguments/command-arguments.ts";
import { helpText } from "../infrastructure/command-line/arguments/command-help.ts";
import type {
  HelpTopic,
  Subcommand,
} from "../infrastructure/command-line/arguments/command-line.ts";
import { RUN_SUBCOMMANDS, runHelpText } from "../infrastructure/command-line/arguments/run-help.ts";
import { installedVersionOf } from "../infrastructure/command-line/installation/installed-version.ts";
import {
  type CommandOutcome,
  loadFailureOutcome,
  versionCommandOutcome,
} from "../infrastructure/command-line/outcomes/command-outcome.ts";
import { printOutcome } from "../infrastructure/command-line/outcomes/print-outcome.ts";
import { commandRunPathOf } from "../infrastructure/command-line/run-path/command-run-path.ts";
import {
  runLoadFailureOutcomeOf,
  upgradeCommandFor,
} from "../infrastructure/command-line/run-path/run-load-failure-outcome.ts";
import { upgradeFailureOutcomeOf } from "../infrastructure/printed-report/upgrade/upgrade-refusal-text.ts";
import type { ToolInvocation } from "./tool-ports.ts";

export type CommandFailure =
  | { readonly failed: "load"; readonly failure: LoadFailure }
  | {
      readonly failed: "run";
      readonly failure: RunLoadFailure;
      readonly repoRoot: AbsolutePath | undefined;
    }
  | {
      readonly failed: "upgrade";
      readonly failure: UpgradeFailure;
      readonly repoRoot: AbsolutePath;
    };

export type ToolCommand<Parsed, Produced, Ports> = {
  readonly parse: (request: {
    readonly arguments: readonly string[];
  }) => Result<Parsed, LoadFailure>;
  readonly run: (request: {
    readonly command: ToolInvocation;
    readonly ports: Ports;
    readonly parsed: Parsed;
  }) => Promise<Result<Produced, CommandFailure>>;
  readonly print: (request: {
    readonly command: ToolInvocation;
    readonly ports: Ports;
    readonly parsed: Parsed;
    readonly produced: Produced;
  }) => CommandOutcome;
};

export type CommandHandler = (command: ToolInvocation) => Promise<void>;

export type Subcommands = Readonly<Record<Subcommand, CommandHandler>>;

type DispatchPorts = { readonly path: PathPort; readonly fileText: FileTextPort };

type FailurePrinting = {
  readonly command: ToolInvocation;
  readonly path: PathPort;
  readonly failure: CommandFailure;
};

export const loadFailed = (request: {
  readonly failure: LoadFailure;
}): Result<never, CommandFailure> => ({
  outcome: "failed",
  error: { failed: "load", failure: request.failure },
});

export const loadResultOf = <Value>(request: {
  readonly result: Result<Value, LoadFailure>;
}): Result<Value, CommandFailure> =>
  request.result.outcome === "failed"
    ? loadFailed({ failure: request.result.error })
    : request.result;

export const runFailed = (request: {
  readonly failure: RunLoadFailure;
  readonly repoRoot: AbsolutePath | undefined;
}): Result<never, CommandFailure> => ({
  outcome: "failed",
  error: { failed: "run", ...request },
});

export const failureOutcomeOf = (request: FailurePrinting): CommandOutcome => {
  const { command, path, failure } = request;
  switch (failure.failed) {
    case "load":
      return loadFailureOutcome({ failure: failure.failure });
    case "run":
      return runLoadFailureOutcomeOf({
        failure: failure.failure,
        upgradeCommand:
          failure.repoRoot === undefined
            ? undefined
            : upgradeCommandFor({ path, moduleUrl: command.moduleUrl, repoRoot: failure.repoRoot }),
      });
    case "upgrade":
      return upgradeFailureOutcomeOf({
        failure: failure.failure,
        placement: { repoRoot: failure.repoRoot, path },
      });
  }
};

export const commandOf =
  <Parsed, Produced, Ports extends { readonly path: PathPort }>(request: {
    readonly tool: ToolCommand<Parsed, Produced, Ports>;
    readonly ports: Ports;
  }): CommandHandler =>
  async (command) => {
    const { tool, ports } = request;
    const parsed = tool.parse({ arguments: command.process.arguments });
    if (parsed.outcome === "failed") {
      printOutcome({
        process: command.process,
        outcome: loadFailureOutcome({ failure: parsed.error }),
      });
      return;
    }
    const ran = await tool.run({ command, ports, parsed: parsed.value });
    printOutcome({
      process: command.process,
      outcome:
        ran.outcome === "failed"
          ? failureOutcomeOf({ command, path: ports.path, failure: ran.error })
          : tool.print({ command, ports, parsed: parsed.value, produced: ran.value }),
    });
  };

const thrownMessage = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

type HelpEdition = "version-1" | "version-2";

type Dispatching = { readonly ports: DispatchPorts; readonly command: ToolInvocation };

const helpEditionOf = (request: Dispatching): HelpEdition => {
  const located = commandRunPathOf({
    command: {
      process: request.command.process,
      path: request.ports.path,
      fileText: request.ports.fileText,
    },
  });
  return located.kind === "repository" &&
    located.chosen.outcome === "ok" &&
    located.chosen.value === "version-1"
    ? "version-1"
    : "version-2";
};

const helpOf = (request: Dispatching & { readonly topic: HelpTopic }): string => {
  const runTopic =
    request.topic === "tool"
      ? request.topic
      : RUN_SUBCOMMANDS.find((subcommand) => subcommand === request.topic);
  return runTopic === undefined || helpEditionOf(request) === "version-1"
    ? helpText({ topic: request.topic })
    : runHelpText({ topic: runTopic });
};

const dispatched = (
  request: Dispatching & { readonly subcommands: Subcommands },
): Promise<void> => {
  const { command, ports } = request;
  const invocation = parseInvocation({ arguments: command.process.arguments });
  if (invocation.outcome === "failed") {
    printOutcome({
      process: command.process,
      outcome: loadFailureOutcome({ failure: invocation.error }),
    });
    return Promise.resolve();
  }
  switch (invocation.value.kind) {
    case "help":
      printOutcome({
        process: command.process,
        outcome: { code: 0, text: helpOf({ ...request, topic: invocation.value.topic }) },
      });
      return Promise.resolve();
    case "version":
      printOutcome({
        process: command.process,
        outcome: versionCommandOutcome({
          result: installedVersionOf({ ...ports, moduleUrl: command.moduleUrl }),
        }),
      });
      return Promise.resolve();
    case "run":
      return request.subcommands[invocation.value.subcommand]({
        ...command,
        process: { ...command.process, arguments: invocation.value.arguments },
      });
  }
};

export const toolCommandOf =
  (request: { readonly subcommands: Subcommands; readonly ports: DispatchPorts }): CommandHandler =>
  (command) =>
    Promise.resolve()
      .then(() => dispatched({ ...request, command }))
      .catch((thrown: unknown) => {
        printOutcome({
          process: command.process,
          outcome: loadFailureOutcome({
            failure: { kind: "unexpected-error", detail: thrownMessage({ thrown }) },
          }),
        });
      });

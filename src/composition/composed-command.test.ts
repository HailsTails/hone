import { describe, expect, it, vi } from "vitest";

import type { PathPort } from "../application/ports/host/path-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import { loadFailureOutcome } from "../infrastructure/command-line/outcomes/command-outcome.ts";
import { runLoadFailureOutcomeOf } from "../infrastructure/command-line/run-path/run-load-failure-outcome.ts";
import { commandOf, loadFailed, runFailed, type ToolCommand } from "./composed-command.ts";

type Recorded = {
  readonly writes: Parameters<ProcessPort["writeOut"]>[];
  readonly exits: Parameters<ProcessPort["exitWith"]>[];
};

const recordedProcessWith = (request: { readonly arguments: readonly string[] }) => {
  const recorded: Recorded = { writes: [], exits: [] };
  const port: ProcessPort = {
    arguments: request.arguments,
    writeOut: (written) => recorded.writes.push([written]),
    writeError: () => undefined,
    exitWith: (exit) => recorded.exits.push([exit]),
  };
  return { port, recorded };
};

const PATH: PathPort = {
  join: vi.fn(),
  joinRepository: vi.fn(),
  relative: vi.fn(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn(),
  fromFileUrl: vi.fn(),
};

const NO_REPO: LoadFailure = { kind: "arguments-invalid", detail: "--repo is required" };

const NOT_READY: RunLoadFailure = {
  kind: "not-ready-yet",
  what: { thing: "command", command: "split-records" },
};

const echoing = (request: {
  readonly run: ToolCommand<string, string, { readonly path: PathPort }>["run"];
}): ToolCommand<string, string, { readonly path: PathPort }> => ({
  parse: ({ arguments: given }) =>
    given[0] === undefined
      ? { outcome: "failed", error: NO_REPO }
      : { outcome: "ok", value: given[0] },
  run: request.run,
  print: ({ produced }) => ({ code: 0, text: `${produced}\n` }),
});

const ranWith = async (request: {
  readonly arguments: readonly string[];
  readonly tool: ToolCommand<string, string, { readonly path: PathPort }>;
}): Promise<Recorded> => {
  const { port, recorded } = recordedProcessWith(request);
  const handler = commandOf({ tool: request.tool, ports: { path: PATH } });
  await handler({ process: port, moduleUrl: "file:///install/src/hone.ts" });
  return recorded;
};

describe("commandOf", () => {
  it("prints the parsed input's outcome through the command's printer", async () => {
    const tool = echoing({
      run: ({ parsed }) => Promise.resolve({ outcome: "ok", value: `ran ${parsed}` }),
    });

    expect(await ranWith({ arguments: ["shop"], tool })).toEqual({
      writes: [[{ text: "ran shop\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("prints the parse failure and runs nothing", async () => {
    const run = vi.fn<ToolCommand<string, string, { readonly path: PathPort }>["run"]>();

    expect(await ranWith({ arguments: [], tool: echoing({ run }) })).toEqual({
      writes: [[{ text: loadFailureOutcome({ failure: NO_REPO }).text }]],
      exits: [[{ code: 2 }]],
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("prints a load failure the run gives", async () => {
    const tool = echoing({ run: () => Promise.resolve(loadFailed({ failure: NO_REPO })) });

    expect(await ranWith({ arguments: ["shop"], tool })).toEqual({
      writes: [[{ text: loadFailureOutcome({ failure: NO_REPO }).text }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints a run failure the run gives, with no upgrade command when no repository was located", async () => {
    const tool = echoing({
      run: () => Promise.resolve(runFailed({ failure: NOT_READY, repoRoot: undefined })),
    });

    expect(await ranWith({ arguments: ["shop"], tool })).toEqual({
      writes: [
        [{ text: runLoadFailureOutcomeOf({ failure: NOT_READY, upgradeCommand: undefined }).text }],
      ],
      exits: [[{ code: 2 }]],
    });
  });
});

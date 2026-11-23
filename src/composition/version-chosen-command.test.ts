import { describe, expect, it, vi } from "vitest";

import type { CommandRequest } from "../application/ports/command-request.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { ExceptionRepositoryOf } from "../application/ports/records/exception-repository.ts";
import type { FilePresence } from "../domain/repository/file-presence.ts";
import type { Subcommand } from "../infrastructure/command-line/arguments/command-line.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import type { CommandHandler } from "./composed-command.ts";
import {
  namedSettingsCommandOf,
  notReadyCommandOf,
  settingsRequiringCommandOf,
  type VersionChoice,
} from "./version-chosen-command.ts";

type Presences = { readonly versionOne: FilePresence; readonly versionTwo: FilePresence };

const VERSION_ONE_ONLY: Presences = { versionOne: "present", versionTwo: "absent" };

const VERSION_TWO_ONLY: Presences = { versionOne: "absent", versionTwo: "present" };

const BOTH: Presences = { versionOne: "present", versionTwo: "present" };

const NEITHER: Presences = { versionOne: "absent", versionTwo: "absent" };

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandOver = (request: {
  readonly process: ProcessPort;
  readonly present: Presences;
}): CommandRequest & { readonly exceptionRepositoryOf: ExceptionRepositoryOf } => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    exists: vi
      .fn<FileTextPort["exists"]>()
      .mockReturnValueOnce(request.present.versionOne)
      .mockReturnValueOnce(request.present.versionTwo),
    read: vi.fn<FileTextPort["read"]>(),
    write: vi.fn<FileTextPort["write"]>(),
  },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  },
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  moduleUrl: "file:///install/src/hone.ts",
});

const handlers = () => ({
  versionOne: vi.fn<CommandHandler>().mockResolvedValue(undefined),
  versionTwo: vi.fn<CommandHandler>().mockResolvedValue(undefined),
});

type Chosen = Omit<VersionChoice, "ports">;

const chosenRan = (request: {
  readonly chooser: (choice: VersionChoice) => CommandHandler;
  readonly chosen: Chosen;
  readonly command: ReturnType<typeof commandOver>;
}): Promise<void> =>
  request.chooser({ ...request.chosen, ports: request.command })(request.command);

const notReadyRan = (request: {
  readonly subcommand: Subcommand;
  readonly command: ReturnType<typeof commandOver>;
}): Promise<void> =>
  notReadyCommandOf({ ports: request.command, command: request.subcommand })(request.command);

describe("namedSettingsCommandOf", () => {
  it.each([
    { repo: "versionOne", present: VERSION_ONE_ONLY, ran: 0 },
    { repo: "versionTwo", present: VERSION_TWO_ONLY, ran: 1 },
    { repo: "neither", present: NEITHER, ran: 1 },
  ])(
    "routes a request to the named handler when supported, given $repo",
    async ({ present, ran }) => {
      const run = vi.fn<CommandHandler>().mockResolvedValue(undefined);
      const command = commandOver({
        process: processWith({ arguments: ["--repo", "/repo"] }),
        present,
      });

      const handle = namedSettingsCommandOf({ ports: command, run });
      await handle(command);
      expect(run).toHaveBeenCalledTimes(ran);
    },
  );

  it("hands the migration handler the original request for a version one repository", async () => {
    const chosen = handlers();
    const command = commandOver({
      process: processWith({ arguments: ["--repo", "/repo"] }),
      present: VERSION_ONE_ONLY,
    });

    await chosenRan({ chooser: settingsRequiringCommandOf, chosen, command });

    expect(vi.mocked(chosen.versionOne).mock.calls).toEqual([[command]]);
  });

  it("delegates a request with no repository to the named handler for its argument check", async () => {
    const run = vi.fn<CommandHandler>().mockResolvedValue(undefined);
    const command = commandOver({ process: processWith({ arguments: [] }), present: NEITHER });
    const handle = namedSettingsCommandOf({ ports: command, run });
    await handle(command);
    expect(run).toHaveBeenCalledExactlyOnceWith(command);
  });

  it("prints the settings-in-both-versions line and exits 2 before calling the named handler", async () => {
    const run = vi.fn<CommandHandler>();
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    const command = commandOver({ process: processPort, present: BOTH });
    const handle = namedSettingsCommandOf({ ports: command, run });
    await handle(command);

    expect({
      ran: run.mock.calls.length,
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
    }).toEqual({
      ran: 0,
      writes: [
        [
          {
            text: "load failure: settings-in-both-versions /repo: it holds both disciplines.json and hone.config.json; keep the one this repository runs on and remove the other\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
    });
  });
});

describe("settingsRequiringCommandOf", () => {
  it("prints the config-absent line and exits 2, running neither handler, when the repository holds neither settings file", async () => {
    const chosen = handlers();
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await chosenRan({
      chooser: settingsRequiringCommandOf,
      chosen,
      command: commandOver({ process: processPort, present: NEITHER }),
    });

    expect({
      ran: [
        vi.mocked(chosen.versionOne).mock.calls.length,
        vi.mocked(chosen.versionTwo).mock.calls.length,
      ],
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
    }).toEqual({
      ran: [0, 0],
      writes: [
        [
          {
            text: "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
    });
  });

  it.each([
    { repo: "versionOne", present: VERSION_ONE_ONLY, ran: [1, 0] },
    { repo: "versionTwo", present: VERSION_TWO_ONLY, ran: [0, 1] },
  ])(
    "runs the handler for the settings file the repository holds, given $repo",
    async ({ present, ran }) => {
      const chosen = handlers();

      await chosenRan({
        chooser: settingsRequiringCommandOf,
        chosen,
        command: commandOver({ process: processWith({ arguments: ["--repo", "/repo"] }), present }),
      });

      expect([
        vi.mocked(chosen.versionOne).mock.calls.length,
        vi.mocked(chosen.versionTwo).mock.calls.length,
      ]).toEqual(ran);
    },
  );
});

describe("notReadyCommandOf", () => {
  it("prints one not-ready-yet line naming the command, and exits 2", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await notReadyRan({
      subcommand: "prune-debt",
      command: commandOver({ process: processPort, present: NEITHER }),
    });

    expect({
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
    }).toEqual({
      writes: [
        [
          {
            text: "load failure: not-ready-yet prune-debt: this release runs prune-debt on version 1 files only, and this repository holds hone.config.json\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
    });
  });
});

describe("namedSettingsCommandOf", () => {
  it("asks a version one repository to upgrade before starting an engine command", async () => {
    const run = vi.fn<CommandHandler>();
    const command = commandOver({
      process: processWith({ arguments: ["--repo", "/repo"] }),
      present: VERSION_ONE_ONLY,
    });
    const handler = namedSettingsCommandOf({ ports: command, run });

    await handler(command);

    expect(run).not.toHaveBeenCalled();
    expect(command.process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(command.process.writeOut).toHaveBeenCalledExactlyOnceWith({
      text: expect.stringContaining("upgrade-needed disciplines.json"),
    });
  });
});

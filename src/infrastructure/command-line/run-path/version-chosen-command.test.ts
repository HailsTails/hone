import { describe, expect, it, vi } from "vitest";
import type { ExceptionRepositoryOf } from "../../discipline-exceptions-folder/exception-records.ts";
import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import type { FilePresence } from "../../../domain/repository/file-presence.ts";
import type { GitPort } from "../../git/git-port.ts";
import type { ModuleLoaderPort } from "../../node/modules/module-loader-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import type { ProcessPort } from "../../node/process/process-port.ts";
import type { CommandRequest } from "../../../application/ports/command-request.ts";
import { notReadyCommandOf, settingsRequiringCommandOf, type VersionedHandler, versionChosenCommandOf } from "./version-chosen-command.ts";

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

const commandOver = (request: { readonly process: ProcessPort; readonly present: Presences }): CommandRequest & { readonly exceptionRepositoryOf: ExceptionRepositoryOf } => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce(request.present.versionOne).mockReturnValueOnce(request.present.versionTwo),
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
  versionOne: vi.fn<VersionedHandler>().mockResolvedValue(undefined),
  versionTwo: vi.fn<VersionedHandler>().mockResolvedValue(undefined),
});

describe("versionChosenCommandOf", () => {
  it.each([
    { repo: "versionOne", present: VERSION_ONE_ONLY, ran: { versionOne: 1, versionTwo: 0 } },
    { repo: "versionTwo", present: VERSION_TWO_ONLY, ran: { versionOne: 0, versionTwo: 1 } },
    { repo: "neither", present: NEITHER, ran: { versionOne: 0, versionTwo: 1 } },
  ])("runs the handler for the settings file the repository holds, given $repo", async ({ present, ran }) => {
    const chosen = handlers();
    const command = commandOver({ process: processWith({ arguments: ["--repo", "/repo"] }), present });

    await versionChosenCommandOf(chosen)(command);

    expect({ versionOne: vi.mocked(chosen.versionOne).mock.calls.length, versionTwo: vi.mocked(chosen.versionTwo).mock.calls.length }).toEqual(ran);
  });

  it("hands the version 1 handler the very request it was given, unchanged", async () => {
    const chosen = handlers();
    const command = commandOver({ process: processWith({ arguments: ["--repo", "/repo"] }), present: VERSION_ONE_ONLY });

    await versionChosenCommandOf(chosen)(command);

    expect(vi.mocked(chosen.versionOne).mock.calls).toEqual([[command]]);
  });

  it("leaves a request with no repository to the version 1 handler, which refuses it as it does today", async () => {
    const chosen = handlers();

    await versionChosenCommandOf(chosen)(commandOver({ process: processWith({ arguments: [] }), present: NEITHER }));

    expect(vi.mocked(chosen.versionOne).mock.calls.length).toBe(1);
  });

  it("prints the settings-in-both-versions line and exits 2, running neither handler, when the repository holds both settings files", async () => {
    const chosen = handlers();
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await versionChosenCommandOf(chosen)(commandOver({ process: processPort, present: BOTH }));

    expect({
      ran: [vi.mocked(chosen.versionOne).mock.calls.length, vi.mocked(chosen.versionTwo).mock.calls.length],
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
    }).toEqual({
      ran: [0, 0],
      writes: [[{ text: "load failure: settings-in-both-versions /repo: it holds both disciplines.json and hone.config.json; keep the one this repository runs on and remove the other\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

describe("settingsRequiringCommandOf", () => {
  it("prints the config-absent line and exits 2, running neither handler, when the repository holds neither settings file", async () => {
    const chosen = handlers();
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await settingsRequiringCommandOf(chosen)(commandOver({ process: processPort, present: NEITHER }));

    expect({
      ran: [vi.mocked(chosen.versionOne).mock.calls.length, vi.mocked(chosen.versionTwo).mock.calls.length],
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
    }).toEqual({
      ran: [0, 0],
      writes: [[{ text: "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it.each([
    { repo: "versionOne", present: VERSION_ONE_ONLY, ran: [1, 0] },
    { repo: "versionTwo", present: VERSION_TWO_ONLY, ran: [0, 1] },
  ])("runs the handler for the settings file the repository holds, given $repo", async ({ present, ran }) => {
    const chosen = handlers();

    await settingsRequiringCommandOf(chosen)(commandOver({ process: processWith({ arguments: ["--repo", "/repo"] }), present }));

    expect([vi.mocked(chosen.versionOne).mock.calls.length, vi.mocked(chosen.versionTwo).mock.calls.length]).toEqual(ran);
  });
});

describe("notReadyCommandOf", () => {
  it("prints one not-ready-yet line naming the command, and exits 2", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await notReadyCommandOf({ command: "prune-debt" })(commandOver({ process: processPort, present: NEITHER }));

    expect({ writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls }).toEqual({
      writes: [[{ text: "load failure: not-ready-yet prune-debt: this release runs prune-debt on version 1 files only, and this repository holds hone.config.json\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

import { assert, describe, expect, it, vi } from "vitest";

import type { EntryKindPort } from "../application/ports/file-system/entry-kind-port.ts";
import type { FileRemovalPort } from "../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { VersionOneCommandRequest as PruneCommand } from "../application/ports/version-one-command-request.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../domain/repository/repo-path-types.ts";
import { shownPathOfRepository } from "../infrastructure/command-line/installation/shown-path.ts";
import { exceptionRepositoryOf } from "../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { exceptionEntryParser } from "../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { createWalkerRunner } from "../infrastructure/engines/walker/runner/create-walker-runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { PRUNE_DEBT } from "./commands.ts";
import { commandOf } from "./composed-command.ts";

const runPruneDebtCommand = (command: PruneCommand) =>
  commandOf({ tool: PRUNE_DEBT, ports: command })(command);

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const modulesServingRunner = (request: {
  readonly runnerSuffix: string;
  readonly runner: unknown;
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => ({
  load: (load) =>
    load.path.replaceAll("\\", "/").endsWith(request.runnerSuffix)
      ? Promise.resolve({ outcome: "ok", value: { runner: request.runner } })
      : request.base.load(load),
});

const slashed = (text: string): string => text.replaceAll("\\", "/");

const OVERLAY_ONLY = "the in-memory overlay writes only the files it overlays";

const inMemoryOverlay = (request: {
  readonly base: FileTextPort;
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
  const files = new Map(Object.entries(request.files).map(([name, text]) => [slashed(name), text]));
  return {
    read: (reading) => {
      const text = files.get(slashed(reading.path));
      return text === undefined ? request.base.read(reading) : { outcome: "ok", value: text };
    },
    exists: (probing) =>
      files.has(slashed(probing.path)) ? "present" : request.base.exists(probing),
    write: (writing) => {
      if (!files.has(slashed(writing.path))) {
        return {
          outcome: "failed",
          error: { kind: "unwritable", path: writing.path, detail: OVERLAY_ONLY },
        };
      }
      files.set(slashed(writing.path), writing.text);
      return { outcome: "ok", value: undefined };
    },
  };
};

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);
const defaultParsePort = loadedParsePort.value;

const path = createDefaultPathPort({});

const disk = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const FIXTURE = resolvedPath({
  path: `${import.meta.dirname}/../operations/prune-debt/prune-debt-answered`,
});

const RECORDS_PATH = `${FIXTURE}/discipline-exceptions.json`;

const recordsOnDisk = disk.read({ path: RECORDS_PATH });
assert(recordsOnDisk.outcome === "ok", "the fixture's records read from disk");

const TOOL_COMMAND_URL = new URL("../hone.ts", import.meta.url).href;

const ANSWERED = repoPathOf("src/answered.ts");
const DOUBLY = repoPathOf("src/doubly.ts");
const REFUSED = repoPathOf("src/refused.ts");

const CLASS_SOURCE = "export class Basket {}\n";

const TRACKED = [
  repoPathOf("discipline-exceptions.json"),
  repoPathOf("disciplines.json"),
  ANSWERED,
  DOUBLY,
  REFUSED,
];

const fixtureRepository = (): FileTextPort =>
  inMemoryOverlay({
    base: { ...disk, write: vi.fn<FileTextPort["write"]>() },
    files: {
      [RECORDS_PATH]: recordsOnDisk.value,
      [`${FIXTURE}/src/answered.ts`]: CLASS_SOURCE,
      [`${FIXTURE}/src/doubly.ts`]: CLASS_SOURCE,
      [`${FIXTURE}/src/refused.ts`]: CLASS_SOURCE,
    },
  });

const auditRunnerOver = (fileText: FileTextPort): ModuleLoaderPort =>
  modulesServingRunner({
    runnerSuffix: "/src/infrastructure/engines/walker/runner/runner.ts",
    runner: createWalkerRunner({
      fileText,
      modules: createDefaultModuleLoaderPort({}),
      path,
      parse: defaultParsePort,
      entryKind: ABSENT_ENTRY_KIND,
    }),
    base: createDefaultModuleLoaderPort({}),
  });

const gitChanging = (changed: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: TRACKED }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: changed }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi
    .fn<GitPort["renamedSince"]>()
    .mockReturnValue({ outcome: "ok", value: new Map() }),
});

const pruneDebtOver = async (request: {
  readonly fileText: FileTextPort;
  readonly git: GitPort;
}) => {
  const writeOut = vi.fn<ProcessPort["writeOut"]>();
  const exitWith = vi.fn<ProcessPort["exitWith"]>();
  const process: ProcessPort = {
    arguments: ["--repo", FIXTURE, "--base-revision", "origin/main"],
    writeOut,
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith,
  };
  const repositoryOf = exceptionRepositoryOf({
    fileText: request.fileText,
    path,
    directory: createDefaultDirectoryPort({}),
    fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
    git: request.git,
    gitTree: {
      pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [] }),
    },
  });
  await runPruneDebtCommand({
    process,
    path,
    fileText: request.fileText,
    engine: createDefaultEnginePort({}),
    modules: auditRunnerOver(request.fileText),
    git: request.git,
    exceptionRepositoryOf: repositoryOf,
    exceptionEntryParser,
    selectionRepositoryOf: createSelectionRepository,
    shownPathOfRepository,
    moduleUrl: TOOL_COMMAND_URL,
  });
  return { printed: writeOut.mock.calls, exits: exitWith.mock.calls };
};

describe("hone prune-debt over debt whose every finding an authorised location answers, through the walker over written-out sources (CD-47: the fixture repository's records are the subject; nothing is spawned or written to disk)", () => {
  it("removes the forfeited carve-out whose class an authorised location answers, and keeps the doubly held one and the one beside a refused authorised location", async () => {
    expect(
      await pruneDebtOver({ fileText: fixtureRepository(), git: gitChanging([ANSWERED, REFUSED]) }),
    ).toEqual({
      printed: [[{ text: "CD-14#class-syntax removed src/answered.ts\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("removes nothing when no file changed, since a carve-out in force beside an authorised location is doubly held, not paid", async () => {
    expect(await pruneDebtOver({ fileText: fixtureRepository(), git: gitChanging([]) })).toEqual({
      printed: [[{ text: "" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("removes the answered carve-out from the records on a first run, and nothing on a second run over the records the first left", async () => {
    const fileText = fixtureRepository();
    const git = gitChanging([ANSWERED, REFUSED]);
    const first = await pruneDebtOver({ fileText, git });
    const second = await pruneDebtOver({ fileText, git });
    expect({ first, second }).toEqual({
      first: {
        printed: [[{ text: "CD-14#class-syntax removed src/answered.ts\n" }]],
        exits: [[{ code: 0 }]],
      },
      second: { printed: [[{ text: "" }]], exits: [[{ code: 0 }]] },
    });
  });
});

import { assert, describe, expect, it, vi } from "vitest";

import type { EntryKindPort } from "../application/ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { RecordsSource } from "../application/ports/records/records-source.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../domain/repository/repo-path-types.ts";
import type { ReadonlyJsonValue } from "../domain/settings/json-values/json-value.ts";
import { createWalkerRunner } from "../infrastructure/engines/walker/runner/create-walker-runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { VERSION_TWO_CHECK } from "./check-command.ts";
import { VERSION_TWO_PRUNE_DEBT } from "./commands.ts";
import { commandOf } from "./composed-command.ts";
import { INSTALLED_PORTS } from "./run-tool-command.ts";
import type { ToolPorts } from "./tool-ports.ts";

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const modulesServingRunner = (request: {
  readonly runnerSuffix: string;
  readonly runner: ReturnType<typeof createWalkerRunner>;
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => ({
  load: (load) =>
    load.path.replaceAll("\\", "/").endsWith(request.runnerSuffix)
      ? Promise.resolve({
          outcome: "ok",
          value: {
            namedChecksRunner: {
              ...request.runner,
              fileScope: "tracked",
              projectedKinds: ["inline-disable"],
            },
          },
        })
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

const TOOL_COMMAND_URL = new URL("../hone.ts", import.meta.url).href;

const ANSWERED = repoPathOf("src/answered.ts");
const DOUBLY = repoPathOf("src/doubly.ts");
const REFUSED = repoPathOf("src/refused.ts");
const CHECK = "authored-class-or-this#class-keyword";
const SETTINGS_FILE = repoPathOf("hone.config.json");
const DEBT_FILE = repoPathOf("hone-records/debt/authored-class-or-this.json");
const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/authored-class-or-this.json");
const TRACKED = [SETTINGS_FILE, DEBT_FILE, AUTHORISED_FILE, ANSWERED, DOUBLY, REFUSED];
const CLASS_SOURCE = "export class Basket {}\n";

const heldAt = (file: RepoPath) => ({ answers: CHECK, file });

const carriedAt = (file: RepoPath) => ({
  ...heldAt(file),
  carried: {
    kind: "authorised-location",
    clause: "CD-14#class-syntax",
    file,
    reason: "The fixture authorises this class.",
  },
});

const recordsText = (records: readonly ReadonlyJsonValue[]): string =>
  JSON.stringify({ version: 2, records });

const pathInFixture = (file: RepoPath): string => path.join({ segments: [FIXTURE, file] });

const fixtureRepository = (): FileTextPort =>
  inMemoryOverlay({
    base: disk,
    files: {
      [pathInFixture(SETTINGS_FILE)]: JSON.stringify({
        version: 2,
        ruleSets: {},
        checks: { [CHECK]: "walker" },
      }),
      [pathInFixture(DEBT_FILE)]: recordsText([ANSWERED, DOUBLY, REFUSED].map(heldAt)),
      [pathInFixture(AUTHORISED_FILE)]: recordsText([
        carriedAt(ANSWERED),
        carriedAt(DOUBLY),
        {
          ...heldAt(REFUSED),
          case: "refused",
          owes: "refused",
          whyChain: { whys: [], rootCause: "", owner: "" },
        },
      ]),
      [pathInFixture(ANSWERED)]: CLASS_SOURCE,
      [pathInFixture(DOUBLY)]: CLASS_SOURCE,
      [pathInFixture(REFUSED)]: CLASS_SOURCE,
    },
  });

const recordsSourceOver = (fileText: FileTextPort): RecordsSource => ({
  read: () => ({
    outcome: "ok",
    value: [DEBT_FILE, AUTHORISED_FILE].map((file) => {
      const content = fileText.read({ path: pathInFixture(file) });
      assert(content.outcome === "ok", `${file} is in the fixture overlay`);
      const document: unknown = JSON.parse(content.value);
      return { file, document };
    }),
  }),
  readAt: () => ({
    outcome: "failed",
    error: {
      kind: "git-failed",
      command: "ls-tree",
      detail: "The record baseline is unavailable in this checkout.",
    },
  }),
});

const walkerOver = (fileText: FileTextPort): ModuleLoaderPort =>
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

const commandPortsOver = (request: {
  readonly fileText: FileTextPort;
  readonly git: GitPort;
}): ToolPorts => ({
  ...INSTALLED_PORTS,
  fileText: request.fileText,
  modules: walkerOver(request.fileText),
  git: request.git,
  recordsSourceOf: () => recordsSourceOver(request.fileText),
  directory: {
    ...INSTALLED_PORTS.directory,
    create: () => ({ outcome: "ok", value: undefined }),
  },
});

const commandInvocation = () => {
  const writeOut = vi.fn<ProcessPort["writeOut"]>();
  const exitWith = vi.fn<ProcessPort["exitWith"]>();
  const process: ProcessPort = {
    arguments: ["--repo", FIXTURE, "--base-revision", "origin/main"],
    writeOut,
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith,
  };
  return { command: { process, moduleUrl: TOOL_COMMAND_URL }, writeOut, exitWith };
};

const pruneDebtOver = async (ports: ToolPorts) => {
  const { command, writeOut, exitWith } = commandInvocation();
  await commandOf({ tool: VERSION_TWO_PRUNE_DEBT, ports })(command);
  return { printed: writeOut.mock.calls, exits: exitWith.mock.calls };
};

const reportOver = async (ports: ToolPorts) => {
  const { command } = commandInvocation();
  const parsed = VERSION_TWO_CHECK.parse({ arguments: command.process.arguments });
  assert(parsed.outcome === "ok");
  const checked = await VERSION_TWO_CHECK.run({ command, ports, parsed: parsed.value });
  assert(checked.outcome === "ok", JSON.stringify(checked));
  return checked.value.run.report;
};

const FORFEITED_LINES =
  "authored-class-or-this#class-keyword removed src/answered.ts: forfeited\n" +
  "authored-class-or-this#class-keyword removed src/refused.ts: forfeited\n";

describe("hone prune-debt through the walker over debt and authorised locations", () => {
  it("prunes debt on both touched files while reporting the invalid authorised location", async () => {
    const fileText = fixtureRepository();
    const ports = commandPortsOver({ fileText, git: gitChanging([ANSWERED, REFUSED]) });
    const report = await reportOver(ports);
    expect(report.refused).toEqual([
      {
        place: { file: AUTHORISED_FILE, index: 2 },
        refusals: [
          {
            kind: "form-refused",
            issues: expect.arrayContaining([
              expect.objectContaining({ path: ["whyChain", "whys"] }),
            ]),
          },
        ],
      },
    ]);
    expect(await pruneDebtOver(ports)).toEqual({
      printed: [[{ text: FORFEITED_LINES }]],
      exits: [[{ code: 0 }]],
    });
    expect(recordsSourceOver(fileText).read()).toMatchObject({
      outcome: "ok",
      value: [
        { file: DEBT_FILE, document: { records: [heldAt(DOUBLY)] } },
        {
          file: AUTHORISED_FILE,
          document: { records: [carriedAt(ANSWERED), carriedAt(DOUBLY), expect.any(Object)] },
        },
      ],
    });
  });

  it("preserves untouched debt held beside a carried authorised location", async () => {
    const fileText = fixtureRepository();
    const ports = commandPortsOver({ fileText, git: gitChanging([]) });
    const report = await reportOver(ports);
    expect(report.answered).toContainEqual(
      expect.objectContaining({
        by: [
          expect.objectContaining({ place: { file: DEBT_FILE, index: 1 } }),
          expect.objectContaining({ place: { file: AUTHORISED_FILE, index: 1 } }),
        ],
      }),
    );
    const before = recordsSourceOver(fileText).read();
    expect(await pruneDebtOver(ports)).toEqual({
      printed: [[{ text: "" }]],
      exits: [[{ code: 0 }]],
    });
    expect(recordsSourceOver(fileText).read()).toEqual(before);
  });

  it("writes the pruned records on the first run and removes nothing on retry", async () => {
    const ports = commandPortsOver({
      fileText: fixtureRepository(),
      git: gitChanging([ANSWERED, REFUSED]),
    });
    const first = await pruneDebtOver(ports);
    const second = await pruneDebtOver(ports);
    expect({ first, second }).toEqual({
      first: { printed: [[{ text: FORFEITED_LINES }]], exits: [[{ code: 0 }]] },
      second: { printed: [[{ text: "" }]], exits: [[{ code: 0 }]] },
    });
  });
});

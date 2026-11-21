import type { VersionOneCommandRequest } from "../src/application/ports/version-one-command-request.ts";
import { CAUSAL_WHY_CHAIN } from "./causal-why-chain.ts";
import type { DirectoryEntry, DirectoryPort, FileRemovalPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import type { GitTreePort } from "../src/infrastructure/git/git-port.ts";
import { createPathPort } from "../src/infrastructure/node/path-port.ts";
import type { ProcessPort } from "../src/infrastructure/node/process/process-port.ts";

export const REPO_FOLDER = "/repo";

export const ENTRY_URL = "file:///install/src/hone.ts";

const SEPARATOR = "/";

export type MemoryRepository = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly removal: FileRemovalPort;
  readonly textOf: (request: { readonly file: string }) => string | undefined;
  readonly filesHeld: () => readonly string[];
};

const absoluteOf = (request: { readonly file: string }): string => `${REPO_FOLDER}${SEPARATOR}${request.file}`;

export const memoryRepositoryOf = (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly outsideFiles?: Readonly<Record<string, string>>;
}): MemoryRepository => {
  const held = new Map([...Object.entries(request.files).map(([file, text]) => [absoluteOf({ file }), text] as const), ...Object.entries({ ...request.outsideFiles })]);
  const keysUnder = (folder: string): readonly string[] => [...held.keys()].filter((key) => key.startsWith(`${folder}${SEPARATOR}`));
  const entriesIn = (folder: string): readonly DirectoryEntry[] => {
    const names = keysUnder(folder).map((key) => key.slice(folder.length + 1));
    return [...new Set(names.map((name) => name.split(SEPARATOR)[0] ?? name))].map((name) => ({
      name,
      kind: names.some((deeper) => deeper.startsWith(`${name}${SEPARATOR}`)) ? "directory" : "file",
    }));
  };
  return {
    fileText: {
      exists: ({ path }) => (held.has(path) || keysUnder(path).length > 0 ? "present" : "absent"),
      read: ({ path }) => {
        const text = held.get(path);
        return text === undefined ? { outcome: "failed", error: { kind: "unreadable", path, detail: "absent" } } : { outcome: "ok", value: text };
      },
      write: ({ path, text }) => {
        held.set(path, text);
        return { outcome: "ok", value: undefined };
      },
    },
    directory: {
      list: ({ path }) => ({ outcome: "ok", value: entriesIn(path) }),
      create: () => ({ outcome: "ok", value: undefined }),
    },
    removal: {
      remove: ({ path }) => {
        held.delete(path);
        return { outcome: "ok", value: undefined };
      },
    },
    textOf: ({ file }) => held.get(absoluteOf({ file })),
    filesHeld: () => [...held.keys()].map((key) => key.slice(REPO_FOLDER.length + 1)).toSorted(),
  };
};

type Writes = Parameters<ProcessPort["writeOut"]>[];

type Exits = Parameters<ProcessPort["exitWith"]>[];

export type RecordedProcess = { readonly port: ProcessPort; readonly writes: Writes; readonly exits: Exits };

export const recordedProcessWith = (request: { readonly arguments: readonly string[] }): RecordedProcess => {
  const writes: Writes = [];
  const exits: Exits = [];
  return {
    port: {
      arguments: request.arguments,
      writeOut: (written) => writes.push([written]),
      writeError: () => undefined,
      exitWith: (exit) => exits.push([exit]),
    },
    writes,
    exits,
  };
};

const notUsed = (): never => {
  throw new Error("this port is not used by the command under test");
};

export const commandOver = (request: { readonly process: ProcessPort; readonly fileText: FileTextPort }): VersionOneCommandRequest => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: request.fileText,
  modules: { load: notUsed },
  git: { trackedPaths: notUsed, changedSince: notUsed, contentInBase: notUsed, textInBase: notUsed, renamedSince: notUsed },
  exceptionRepositoryOf: notUsed,
  moduleUrl: ENTRY_URL,
});

export const authoriseArgumentsFor = (request: { readonly repo: string; readonly rootCause: string }): readonly string[] => [
  "--repo",
  request.repo,
  "--answers",
  "claimed-type",
  "--file",
  "src/a.ts",
  "--case",
  "gives-a-value-its-type",
  "--owes",
  "declared-not-asserted",
  ...CAUSAL_WHY_CHAIN.whys.flatMap((why) => ["--why", why.why, "--because", why.because, "--evidence", why.evidence]),
  "--root-cause",
  request.rootCause,
  "--root-evidence",
  CAUSAL_WHY_CHAIN.rootEvidence,
  "--readback",
  CAUSAL_WHY_CHAIN.readback,
  "--owner",
  CAUSAL_WHY_CHAIN.owner,
];

export const gitTreeStub =(): GitTreePort => ({ pathsAt: () => ({ outcome: "ok", value: [] }) });

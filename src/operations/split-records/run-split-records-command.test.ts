import { describe, expect, it, vi } from "vitest";
import { type ExceptionLayoutPorts, exceptionRepositoryOf } from "../../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { DirectoryEntry } from "../../application/ports/file-system/directory-port.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../../application/ports/host/process-port.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { runSplitRecordsCommand } from "./run-split-records-command.ts";
import { createDefaultEnginePort } from "../../infrastructure/engines/protocol/engine-port.ts";

type RecordsDisk = {
  readonly repoRoot: AbsolutePath;
  readonly ports: ExceptionLayoutPorts;
  readonly texts: () => Readonly<Record<string, string>>;
};

const ROOT = "/repo";

const absoluteKey = (request: { readonly file: string }): string => `${ROOT}/${request.file}`;

const childEntryOf = (request: { readonly path: string; readonly folder: string }): DirectoryEntry => {
  const [name, ...rest] = request.path.slice(request.folder.length + 1).split("/");
  return { name, kind: rest.length === 0 ? "file" : "directory" };
};

const childrenOf = (request: { readonly paths: readonly string[]; readonly folder: string }): readonly DirectoryEntry[] => {
  const children = request.paths
    .filter((path) => path.startsWith(`${request.folder}/`))
    .map((path) => childEntryOf({ path, folder: request.folder }));
  return [...new Map(children.map((child) => [child.name, child])).values()];
};

const recordsDisk = (request: { readonly working: Readonly<Record<string, string>> }): RecordsDisk => {
  const files = new Map(Object.entries(request.working).map(([file, text]) => [absoluteKey({ file }), text]));
  const folders = new Set<string>();
  const occupied = (): readonly string[] => [...files.keys(), ...[...folders].map((folder) => `${folder}/`)];
  return {
    repoRoot: absolutePathSchema.parse(ROOT),
    texts: () => Object.fromEntries([...files.entries()].map(([path, text]) => [path.slice(ROOT.length + 1), text])),
    ports: {
      path: createPathPort({ flavour: "posix", workingDirectory: () => ROOT }),
      fileText: {
        read: ({ path }) => {
          const text = files.get(path);
          return text === undefined ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } } : { outcome: "ok", value: text };
        },
        exists: ({ path }) => (files.has(path) || occupied().some((candidate) => candidate.startsWith(`${path}/`)) ? "present" : "absent"),
        write: ({ path, text }) => {
          files.set(path, text);
          return { outcome: "ok", value: undefined };
        },
      },
      directory: {
        list: ({ path }) => ({ outcome: "ok", value: childrenOf({ paths: [...files.keys()], folder: path }).toSorted((left, right) => (left.name < right.name ? -1 : 1)) }),
        create: ({ path }) => {
          folders.add(path);
          return { outcome: "ok", value: undefined };
        },
      },
      fileRemoval: {
        remove: ({ path }) => {
          files.delete(path);
          return { outcome: "ok", value: undefined };
        },
      },
      git: {
        trackedPaths: () => ({ outcome: "ok", value: [] }),
        changedSince: () => ({ outcome: "ok", value: [] }),
        contentInBase: () => ({ outcome: "ok", value: "absent-from-base" }),
        textInBase: () => ({ outcome: "ok", value: { presence: "absent-from-base" } }),
        renamedSince: () => ({ outcome: "ok", value: new Map() }),
      },
      gitTree: { pathsAt: () => ({ outcome: "ok", value: [] }) },
    },
  };
};

const SELECTION_TEXT = '{ "version": 1, "disciplines": [] }';

const SINGLE_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/a.ts",
      "reason": "held by the adapter"
    },
    {
      "kind": "authorised-location",
      "clause": "CD-19#import-boundaries",
      "file": "src/c.ts",
      "reason": "the one wrapping site"
    }
  ]
}
`;

const CARVE_OUTS_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/a.ts",
      "reason": "held by the adapter"
    }
  ]
}
`;

const LOCATIONS_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "authorised-location",
      "clause": "CD-19#import-boundaries",
      "file": "src/c.ts",
      "reason": "the one wrapping site"
    }
  ]
}
`;

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandOver = (request: { readonly disk: RecordsDisk; readonly process: ProcessPort }): VersionOneCommandRequest => ({
  process: request.process,
  path: request.disk.ports.path,
  fileText: request.disk.ports.fileText,
  engine: createDefaultEnginePort({}),
  modules: { load: vi.fn() },
  git: request.disk.ports.git,
  exceptionRepositoryOf: exceptionRepositoryOf(request.disk.ports),
  moduleUrl: "file:///install/src/hone.ts",
});

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("runSplitRecordsCommand", () => {
  it("writes each rule file, removes discipline-exceptions.json, prints each and exits 0", async () => {
    const disk = recordsDisk({ working: { "disciplines.json": SELECTION_TEXT, "discipline-exceptions.json": SINGLE_TEXT } });
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runSplitRecordsCommand(commandOver({ disk, process: processPort }));

    expect({ output: outputOf({ process: processPort }), texts: disk.texts() }).toEqual({
      output: {
        writes: [
          [
            {
              text: "discipline-exceptions/authorised-locations/cd-19.json written\ndiscipline-exceptions/file-carve-outs/cd-19.json written\ndiscipline-exceptions.json removed\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      texts: {
        "disciplines.json": SELECTION_TEXT,
        "discipline-exceptions/authorised-locations/cd-19.json": LOCATIONS_TEXT,
        "discipline-exceptions/file-carve-outs/cd-19.json": CARVE_OUTS_TEXT,
      },
    });
  });

  it("exits 2 naming both layouts relative to --repo when the repository holds both, changing nothing", async () => {
    const working = {
      "disciplines.json": SELECTION_TEXT,
      "discipline-exceptions.json": SINGLE_TEXT,
      "discipline-exceptions/file-carve-outs/cd-19.json": CARVE_OUTS_TEXT,
    };
    const disk = recordsDisk({ working });
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runSplitRecordsCommand(commandOver({ disk, process: processPort }));

    expect({ output: outputOf({ process: processPort }), texts: disk.texts() }).toEqual({
      output: {
        writes: [
          [
            {
              text: "load failure: records-in-both-layouts discipline-exceptions.json discipline-exceptions: Hone reads exception records from one layout; keep each record in one of them and remove the other\n",
            },
          ],
        ],
        exits: [[{ code: 2 }]],
      },
      texts: working,
    });
  });

});

describe("runSplitRecordsCommand with nothing it can do", () => {
  it("says there is nothing to split for a repository already split", async () => {
    const disk = recordsDisk({ working: { "disciplines.json": SELECTION_TEXT, "discipline-exceptions/file-carve-outs/cd-19.json": CARVE_OUTS_TEXT } });
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runSplitRecordsCommand(commandOver({ disk, process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "discipline-exceptions already holds the records split: nothing to split\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("exits 2 with arguments-invalid when --repo is missing", async () => {
    const disk = recordsDisk({ working: {} });
    const processPort = processWith({ arguments: [] });

    await runSplitRecordsCommand(commandOver({ disk, process: processPort }));

    expect(outputOf({ process: processPort }).exits).toEqual([[{ code: 2 }]]);
  });
});

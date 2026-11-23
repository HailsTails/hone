import { describe, expect, it } from "vitest";

import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { VERSION_TWO_NEEDED } from "./commands.ts";
import { commandOf } from "./composed-command.ts";

const versionTwoNeededCommandOf = (command: VersionOneCommandRequest) =>
  commandOf({ tool: VERSION_TWO_NEEDED, ports: command })(command);

const notUsed = (): never => {
  throw new Error("this port is not used by the command under test");
};

const memoryFileTextOf = (request: {
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
  const held = new Map<string, string>(
    Object.entries(request.files).map(([file, text]) => [`/repo/${file}`, text]),
  );
  const holdsUnder = (path: string): boolean =>
    [...held.keys()].some((key) => key.startsWith(`${path}/`));
  return {
    exists: ({ path }) => (held.has(path) || holdsUnder(path) ? "present" : "absent"),
    read: ({ path }) => {
      const text = held.get(path);
      return text === undefined
        ? { outcome: "failed", error: { kind: "unreadable", path, detail: "absent" } }
        : { outcome: "ok", value: text };
    },
    write: ({ path, text }) => {
      held.set(path, text);
      return { outcome: "ok", value: undefined };
    },
  };
};

const commandOver = (request: {
  readonly process: ProcessPort;
  readonly fileText: FileTextPort;
}): VersionOneCommandRequest => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: request.fileText,
  modules: { load: notUsed },
  git: {
    trackedPaths: notUsed,
    changedSince: notUsed,
    contentInBase: notUsed,
    textInBase: notUsed,
    renamedSince: notUsed,
  },
  exceptionRepositoryOf: notUsed,
  exceptionEntryParser: {
    parseExceptionEntries: notUsed,
    importedEntriesIn: notUsed,
    importSourcesOf: notUsed,
  },
  selectionRepositoryOf: notUsed,
  shownPathOfRepository: notUsed,
  moduleUrl: "file:///install/src/hone.ts",
});

const ranOver = async (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly arguments: readonly string[];
}) => {
  const writes: Parameters<ProcessPort["writeOut"]>[] = [];
  const exits: Parameters<ProcessPort["exitWith"]>[] = [];
  const processPort: ProcessPort = {
    arguments: request.arguments,
    writeOut: (written) => writes.push([written]),
    writeError: () => undefined,
    exitWith: (exit) => exits.push([exit]),
  };
  await versionTwoNeededCommandOf(
    commandOver({ process: processPort, fileText: memoryFileTextOf({ files: request.files }) }),
  );
  return { writes, exits };
};

describe("versionTwoNeededCommandOf", () => {
  it("names the version 1 file that needs upgrading when the folder holds disciplines.json", async () => {
    expect(
      await ranOver({ files: { "disciplines.json": "{}" }, arguments: ["--repo", "/repo"] }),
    ).toEqual({
      writes: [
        [
          {
            text: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run node /install/src/hone.ts upgrade --repo /repo, which rewrites every version 1 file as version 2, and commit what it writes\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
    });
  });

  it("says the folder holds no hone.config.json when it holds no version 1 file either", async () => {
    expect(await ranOver({ files: {}, arguments: ["--repo", "/repo"] })).toEqual({
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

  it("says --repo is needed, without looking at any file, when it is not given", async () => {
    expect(await ranOver({ files: { "disciplines.json": "{}" }, arguments: [] })).toEqual({
      writes: [
        [
          {
            text: "load failure: arguments-invalid hone authorise needs --repo <dir>: the folder that holds hone.config.json, usually the repository root\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
    });
  });
});

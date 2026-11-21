import { describe, expect, it, vi } from "vitest";
import { type RecordsDisk, recordsDisk } from "../../../tests/records-disk.ts";
import { exceptionRepositoryOf } from "../../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import type { ProcessPort } from "../../infrastructure/node/process/process-port.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { runSplitRecordsCommand } from "./run-split-records-command.ts";

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
    const disk = recordsDisk({ working: { "disciplines.json": SELECTION_TEXT, "discipline-exceptions.json": SINGLE_TEXT }, base: {} });
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
    const disk = recordsDisk({ working, base: {} });
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
    const disk = recordsDisk({ working: { "disciplines.json": SELECTION_TEXT, "discipline-exceptions/file-carve-outs/cd-19.json": CARVE_OUTS_TEXT }, base: {} });
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runSplitRecordsCommand(commandOver({ disk, process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "discipline-exceptions already holds the records split: nothing to split\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("exits 2 with arguments-invalid when --repo is missing", async () => {
    const disk = recordsDisk({ working: {}, base: {} });
    const processPort = processWith({ arguments: [] });

    await runSplitRecordsCommand(commandOver({ disk, process: processPort }));

    expect(outputOf({ process: processPort }).exits).toEqual([[{ code: 2 }]]);
  });
});

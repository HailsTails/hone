import { describe, expect, it } from "vitest";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import { INSTALLED_PORTS, toolCommandOver } from "./run-tool-command.ts";
import type { VersionOneCommandRequest as ToolCommandRequest } from "../application/ports/version-one-command-request.ts";
import { createDefaultExceptionRepositoryOf } from "../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { absolutePathSchema } from "../infrastructure/content-files/absolute-path.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../application/ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { RepoPath } from "../domain/repository/repo-path-types.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { exceptionEntryParser } from "../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { shownPathOfRepository } from "../infrastructure/command-line/installation/shown-path.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";

const commandRan = (command: ToolCommandRequest): Promise<void> => toolCommandOver({ ...INSTALLED_PORTS, ...command })(command);

type FencedBlock = { readonly language: string; readonly body: string };

type WorkedExample = {
  readonly blocks: number;
  readonly settings: FencedBlock;
  readonly beforeReport: FencedBlock;
  readonly records: FencedBlock;
  readonly afterReport: FencedBlock;
};

const FENCED_BLOCK = /^```(\w*)\n([\s\S]*?)\n```$/gm;

const WORKED_EXAMPLE_HEADING = "\n## Worked example\n";

const NEXT_HEADING = "\n## ";

const INSTALLED_RULES = "node_modules/@hailstails/hone/rules/";

const SOURCE_RULES = "../../../../../../rules/";

const MISSING_BLOCK: FencedBlock = { language: "missing", body: "" };

const contractTextAt = (request: { readonly path: string }): string => {
  const text = createDefaultFileTextPort({}).read(request);
  return text.outcome === "ok" ? text.value : "";
};

const REPOSITORY_ROOT = createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/..`, ".."] });

const ADOPTING_GUIDE_TEXT = contractTextAt({ path: `${REPOSITORY_ROOT}/ADOPTING.md` });

const workedExampleBlocksOf = (request: { readonly text: string }): readonly FencedBlock[] => {
  const from = request.text.slice(request.text.indexOf(WORKED_EXAMPLE_HEADING) + 1);
  const next = from.indexOf(NEXT_HEADING);
  const section = next === -1 ? from : from.slice(0, next);
  return [...section.matchAll(FENCED_BLOCK)].map((block) => ({ language: block[1], body: block[2] }));
};

const workedExampleOf = (request: { readonly text: string }): WorkedExample => {
  const blocks = workedExampleBlocksOf(request);
  const [settings, beforeReport, records, afterReport] = blocks;
  return { blocks: blocks.length, settings: settings ?? MISSING_BLOCK, beforeReport: beforeReport ?? MISSING_BLOCK, records: records ?? MISSING_BLOCK, afterReport: afterReport ?? MISSING_BLOCK };
};

const reportAsInstalled = (request: { readonly text: string }): string => request.text.replaceAll(SOURCE_RULES, INSTALLED_RULES);

type Writes = Parameters<ProcessPort["writeOut"]>[];

type Exits = Parameters<ProcessPort["exitWith"]>[];

type RecordedProcess = { readonly port: ProcessPort; readonly writes: Writes; readonly exits: Exits };

const recordedProcessWith = (request: { readonly arguments: readonly string[] }): RecordedProcess => {
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

const WALKTHROUGH = `${import.meta.dirname}/../infrastructure/command-line/documentation/walkthrough`;

const BEFORE = `${WALKTHROUGH}/before`;

const AFTER = `${WALKTHROUGH}/after`;

const ENTRY_URL = new URL("../hone.ts", import.meta.url).href;

const BEFORE_TRACKED: readonly RepoPath[] = [
  repoPathOf("generated/schema.ts"),
  repoPathOf("hone.config.json"),
  repoPathOf("src/basket.test.ts"),
  repoPathOf("src/basket.ts"),
  repoPathOf("src/utils/format.ts"),
];

const AFTER_TRACKED: readonly RepoPath[] = [
  repoPathOf("generated/schema.ts"),
  repoPathOf("hone-records/boundary-records.json"),
  repoPathOf("hone.config.json"),
  repoPathOf("src/basket.test.ts"),
  repoPathOf("src/basket.ts"),
  repoPathOf("src/clock.test.ts"),
  repoPathOf("src/clock.ts"),
  repoPathOf("src/format.test.ts"),
  repoPathOf("src/format.ts"),
];

const notUsed = (): never => {
  throw new Error("this port is not used by the check");
};

const trackingGit = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: () => ({ outcome: "ok", value: request.tracked }),
  changedSince: notUsed,
  contentInBase: notUsed,
  textInBase: notUsed,
  renamedSince: notUsed,
});

const commandOver = (request: { readonly tracked: readonly RepoPath[]; readonly process: ProcessPort }): VersionOneCommandRequest => ({
  process: request.process,
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  engine: createDefaultEnginePort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: trackingGit({ tracked: request.tracked }),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  exceptionEntryParser,
  selectionRepositoryOf: createSelectionRepository,
  shownPathOfRepository,
  moduleUrl: ENTRY_URL,
});

const checkedOutput = async (request: { readonly repo: string; readonly tracked: readonly RepoPath[] }) => {
  const recorded = recordedProcessWith({ arguments: ["check", "--repo", request.repo] });
  await commandRan(commandOver({ tracked: request.tracked, process: recorded.port }));
  return { writes: recorded.writes, exits: recorded.exits };
};

const fixtureText = (request: { readonly file: string }): string => contractTextAt({ path: request.file });

const checkedReport = async (request: { readonly repo: string; readonly tracked: readonly RepoPath[] }) => {
  const ran = await checkedOutput(request);
  return { writes: ran.writes.map(([written]) => ({ text: reportAsInstalled({ text: written.text }) })), exits: ran.exits };
};

const GUIDE = workedExampleOf({ text: ADOPTING_GUIDE_TEXT });

const SETTINGS_FILE = { language: "json", body: fixtureText({ file: `${BEFORE}/hone.config.json` }).trimEnd() };

const RECORDS_FILE = { language: "json", body: fixtureText({ file: `${AFTER}/hone-records/boundary-records.json` }).trimEnd() };

const SETTINGS_TEXT_BEFORE = fixtureText({ file: `${BEFORE}/hone.config.json` });

const SETTINGS_TEXT_AFTER = fixtureText({ file: `${AFTER}/hone.config.json` });

const BEFORE_REPORT = { writes: [{ text: `${GUIDE.beforeReport.body}
` }], exits: [[{ code: 1 }]] };

const AFTER_REPORT = { writes: [{ text: `${GUIDE.afterReport.body}
` }], exits: [[{ code: 0 }]] };

const FOUR_BLOCKS = 4;

const directory = createDefaultDirectoryPort({});

const filesUnder = (request: { readonly folder: string; readonly prefix: string }): readonly string[] => {
  const listed = directory.list({ path: absolutePathSchema.parse(request.folder) });
  return listed.outcome === "ok"
    ? listed.value.flatMap((entry) =>
        entry.kind === "file" ? [`${request.prefix}${entry.name}`] : filesUnder({ folder: `${request.folder}/${entry.name}`, prefix: `${request.prefix}${entry.name}/` }),
      )
    : [];
};

const fixtureFilesOf = (request: { readonly folder: string }): readonly string[] => filesUnder({ folder: request.folder, prefix: "" }).toSorted();

describe("workedExampleOf over a written-out section, so the block count can fail", () => {
  it("counts the blocks it found, so a missing or extra block is seen", () => {
    expect(workedExampleOf({ text: "## Worked example\n\nno blocks\n" }).blocks).toBe(0);
  });
});

describe("the walkthrough repositories", () => {
  it("track exactly the files the fixed and unfixed fixture folders hold, since git is the only port stubbed", () => {
    expect({ before: fixtureFilesOf({ folder: BEFORE }), after: fixtureFilesOf({ folder: AFTER }) }).toEqual({ before: [...BEFORE_TRACKED], after: [...AFTER_TRACKED] });
  });
});

describe("the adopting guide's worked example, run on version 2 through the shipped engines (CD-47: the shipped pieces and the fixture's own files are the assertion's subject; nothing is spawned or written)", () => {
  it("shows exactly the four blocks the test reads: the settings, the two reports and the record", () => {
    expect(GUIDE.blocks).toBe(FOUR_BLOCKS);
  });

  it("shows the settings file both repositories hold", () => {
    expect(GUIDE.settings).toEqual(SETTINGS_FILE);
    expect(SETTINGS_TEXT_AFTER).toBe(SETTINGS_TEXT_BEFORE);
  });

  it("shows the boundary record the fixed repository holds", () => {
    expect(GUIDE.records).toEqual(RECORDS_FILE);
  });

  it("fails before the fix with one finding per violation and none in the excluded generated folder, printing the report the guide shows and exiting 1", async () => {
    expect(await checkedReport({ repo: BEFORE, tracked: BEFORE_TRACKED })).toEqual(BEFORE_REPORT);
  });

  it("passes after the fix with the clock adapter answered by its boundary record, printing the report the guide shows and exiting 0", async () => {
    expect(await checkedReport({ repo: AFTER, tracked: AFTER_TRACKED })).toEqual(AFTER_REPORT);
  });
});

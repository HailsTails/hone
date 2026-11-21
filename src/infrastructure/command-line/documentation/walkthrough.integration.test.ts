import { describe, expect, it } from "vitest";
import type { VersionOneCommandRequest } from "../../../application/ports/version-one-command-request.ts";
import { runToolCommand } from "../../../run-tool-command.ts";
import { createDefaultExceptionRepositoryOf } from "../../discipline-exceptions-folder/exception-layout.ts";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import type { GitPort } from "../../git/git-port.ts";
import { createDefaultModuleLoaderPort } from "../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import type { ProcessPort } from "../../node/process/process-port.ts";
import { type RepoPath, repoPathSchema } from "../../hone-records-folder/repo-path.ts";

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

const REPOSITORY_ROOT = createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/../../..`, ".."] });

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

const WALKTHROUGH = `${import.meta.dirname}/walkthrough`;

const BEFORE = `${WALKTHROUGH}/before`;

const AFTER = `${WALKTHROUGH}/after`;

const ENTRY_URL = new URL("../../../hone.ts", import.meta.url).href;

const BEFORE_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("generated/schema.ts"),
  repoPathSchema.parse("hone.config.json"),
  repoPathSchema.parse("src/basket.test.ts"),
  repoPathSchema.parse("src/basket.ts"),
  repoPathSchema.parse("src/utils/format.ts"),
];

const AFTER_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("generated/schema.ts"),
  repoPathSchema.parse("hone-records/boundary-records.json"),
  repoPathSchema.parse("hone.config.json"),
  repoPathSchema.parse("src/basket.test.ts"),
  repoPathSchema.parse("src/basket.ts"),
  repoPathSchema.parse("src/clock.test.ts"),
  repoPathSchema.parse("src/clock.ts"),
  repoPathSchema.parse("src/format.test.ts"),
  repoPathSchema.parse("src/format.ts"),
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
  modules: createDefaultModuleLoaderPort({}),
  git: trackingGit({ tracked: request.tracked }),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  moduleUrl: ENTRY_URL,
});

const checkedOutput = async (request: { readonly repo: string; readonly tracked: readonly RepoPath[] }) => {
  const recorded = recordedProcessWith({ arguments: ["check", "--repo", request.repo] });
  await runToolCommand(commandOver({ tracked: request.tracked, process: recorded.port }));
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

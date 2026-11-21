import { describe, expect, it } from "vitest";
import { helpBlocksIn, printedHelpBlockOf, printedHelpBlocksOf } from "../../../../tests/printed-help.ts";
import { contractGaps, contractPartsOf, contractTextAt, documentedLinesIn, documentedRolesIn } from "../../../../tests/output-contract.ts";
import { PRINTABLE_LINES, PRINTED_BLOCKS, PRINTED_SECTION_ROLES } from "../../../../tests/printable-lines.ts";
import { RECORD_COMMAND_LINES } from "../../../../tests/printable-record-command-lines.ts";
import { RUN_FAILURE_LINES, RUN_PRINTED_BLOCKS } from "../../../../tests/printable-run-failure-lines.ts";
import { RUN_PRINTABLE_LINES, RUN_SECTION_ROLES } from "../../../../tests/printable-run-lines.ts";

const CONTRACT_TEXT = contractTextAt({ path: `${import.meta.dirname}/../../../../docs/output-contract.md` });

const CONTRACT_PARTS = contractPartsOf({ text: CONTRACT_TEXT });

const README_TEXT = contractTextAt({ path: `${import.meta.dirname}/../../../../README.md` });

describe("docs/output-contract.md, read against every line the command can print (CD-47: the shipped contract page is the assertion's subject; nothing is spawned)", () => {
  it("documents every printed line as its template filled with that line's own sample values, and every documented line is one the command prints", () => {
    expect(contractGaps({ documented: documentedLinesIn({ text: CONTRACT_PARTS.versionOne }), printed: PRINTABLE_LINES })).toEqual({
      undocumented: [],
      unprinted: [],
    });
  });

  it("lists every report section in the order the report prints them, with its role", () => {
    expect(documentedRolesIn({ text: CONTRACT_PARTS.versionOne })).toEqual(PRINTED_SECTION_ROLES);
  });

  it.each(PRINTED_BLOCKS)("shows the synopsis and each help exactly as printed: %s", (block) => {
    expect(CONTRACT_PARTS.versionOne).toContain(block);
  });

  it("pins the README to the version 2 run synopsis, which no command prints yet", () => {
    expect(README_TEXT).toContain(RUN_PRINTED_BLOCKS[0]);
  });
});

describe("the version 2 part of docs/output-contract.md, read against every line the version 2 report can print", () => {
  it("documents every printed line as its template filled with that line's own sample values, and every documented line is one the report prints", () => {
    expect(contractGaps({ documented: documentedLinesIn({ text: CONTRACT_PARTS.versionTwo }), printed: [...RUN_PRINTABLE_LINES, ...RUN_FAILURE_LINES, ...RECORD_COMMAND_LINES] })).toEqual({
      undocumented: [],
      unprinted: [],
    });
  });

  it("lists every version 2 report section in the order the report prints them, with its role", () => {
    expect(documentedRolesIn({ text: CONTRACT_PARTS.versionTwo })).toEqual(RUN_SECTION_ROLES);
  });

  it.each(RUN_PRINTED_BLOCKS)("shows the version 2 synopsis and each help exactly as printed: %s", (block) => {
    expect(CONTRACT_PARTS.versionTwo).toContain(block);
  });
});

const VERSION_TWO_REPOSITORY = { "hone.config.json": "{}" };

const VERSION_TWO_HELP_CASES = [
  { topic: "the tool", given: ["--help"] },
  { topic: "check", given: ["check", "--repo", "/repo", "--help"] },
  { topic: "project", given: ["project", "--repo", "/repo", "--help"] },
  { topic: "record-debt", given: ["record-debt", "--repo", "/repo", "--help"] },
  { topic: "prune-debt", given: ["prune-debt", "--repo", "/repo", "--help"] },
  { topic: "authorise", given: ["authorise", "--repo", "/repo", "--help"] },
  { topic: "upgrade", given: ["upgrade", "--repo", "/repo", "--help"] },
] as const;

describe("the help docs/output-contract.md shows for version 2, read against what hone prints for a version 2 repository", () => {
  it.each(VERSION_TWO_HELP_CASES)("shows the help of $topic exactly as the command prints it", async ({ given }) => {
    expect(CONTRACT_PARTS.versionTwo).toContain(await printedHelpBlockOf({ given, files: VERSION_TWO_REPOSITORY }));
  });

  it("shows no help block the command does not print, so a stale or extra block fails", async () => {
    expect(helpBlocksIn({ text: CONTRACT_PARTS.versionTwo })).toEqual(await printedHelpBlocksOf({ cases: VERSION_TWO_HELP_CASES, files: VERSION_TWO_REPOSITORY }));
  });

  it("shows, in the 1.x part, the split-records help the command prints for a version 2 repository", async () => {
    expect(CONTRACT_PARTS.versionOne).toContain(await printedHelpBlockOf({ given: ["split-records", "--repo", "/repo", "--help"], files: VERSION_TWO_REPOSITORY }));
  });
});

import { describe, expect, it } from "vitest";
import { runHelpText } from "../src/operations/help/run-help.ts";
import { helpBlocksIn, printedHelpBlockOf, printedHelpBlocksOf } from "./printed-help.ts";

const VERSION_TWO_REPOSITORY = { "hone.config.json": "{}" };

const TOOL_HELP_BLOCK = `\`\`\`text\n${runHelpText({ topic: "tool" })}\`\`\``;

const PROJECT_HELP_BLOCK = `\`\`\`text\n${runHelpText({ topic: "project" })}\`\`\``;

describe("printedHelpBlockOf", () => {
  it("is the help the command prints for the arguments, as the fenced block the contract shows", async () => {
    expect(await printedHelpBlockOf({ given: ["--help"], files: VERSION_TWO_REPOSITORY })).toBe(TOOL_HELP_BLOCK);
  });
});

describe("printedHelpBlocksOf", () => {
  it("is each case's printed block, in sorted order", async () => {
    expect(await printedHelpBlocksOf({ cases: [{ given: ["project", "--help"] }, { given: ["--help"] }], files: VERSION_TWO_REPOSITORY })).toEqual([
      TOOL_HELP_BLOCK,
      PROJECT_HELP_BLOCK,
    ]);
  });
});

describe("helpBlocksIn", () => {
  it("is each fenced block that opens with a usage line, in sorted order, and no other fenced block", () => {
    expect(helpBlocksIn({ text: "```text\nhone --help\n```\n\n```text\nusage: b\n```\n\n```text\nusage: a\n```\n" })).toEqual([
      "```text\nusage: a\n```",
      "```text\nusage: b\n```",
    ]);
  });
});

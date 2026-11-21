import { describe, expect, it } from "vitest";
import { RUN_FAILURE_LINES, RUN_PRINTED_BLOCKS } from "./printable-run-failure-lines.ts";

describe("RUN_FAILURE_LINES", () => {
  it.each([
    { label: "unknown-check", text: "load failure: unknown-check claimed-type#casts", fills: { check: "claimed-type#casts" } },
    { label: "unknown-check", text: "load failure: unknown-check my check#x y", fills: { check: "my check#x y" } },
    {
      label: "engine-not-allowed",
      text: "load failure: engine-not-allowed claimed-type#cast-expressions walker: the rule set does not run that check on that engine, though its catalogue says it does; list the check with an engine its rule set runs it on, or correct the rule set",
      fills: { check: "claimed-type#cast-expressions", engine: "walker" },
    },
    {
      label: "records-file-not-json",
      text: 'load failure: records-file-not-json "hone-records/debt/claimed type.json" Unexpected token',
      fills: { "records file": '"hone-records/debt/claimed type.json"', detail: "Unexpected token" },
    },
    {
      label: "catalogue-not-read",
      text: "load failure: catalogue-not-read node_modules/@hailstails/hone/rules/typescript/symptoms.json symptoms: expected an array",
      fills: { path: "node_modules/@hailstails/hone/rules/typescript/symptoms.json", detail: "symptoms: expected an array" },
    },
  ])("includes the $label line $text with its sample values", (line) => {
    expect(RUN_FAILURE_LINES).toContainEqual(line);
  });

  it.each([
    { label: "records-refused", text: "load failure: records-refused hone-records/debt/claimed-type.json document-refused records.0.file: expected a repository path; hone-records/notes.md not-a-records-file" },
    { label: "engine-failed", text: "load failure: engine-failed eslint tool-failed eslint exited 2" },
    {
      label: "settings-in-both-versions",
      text: "load failure: settings-in-both-versions /work/shop: it holds both disciplines.json and hone.config.json; keep the one this repository runs on and remove the other",
    },
    {
      label: "not-ready-yet",
      text: "load failure: not-ready-yet record-debt: this release runs record-debt on version 1 files only, and this repository holds hone.config.json",
    },
    {
      label: "not-ready-yet",
      text: "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: vendor/lib, vendor/tool; move them out of this repository, and run each on its own with --repo",
    },
    { label: "upgrade-needed", text: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run hone upgrade, which rewrites every version 1 file as version 2, and commit what it writes" },
    { label: "upgrade-needed", text: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run node /work/shop/node_modules/@hailstails/hone/src/hone.js upgrade --repo /work/shop, which rewrites every version 1 file as version 2, and commit what it writes" },
  ])("includes the $label line $text", (line) => {
    expect(RUN_FAILURE_LINES).toContainEqual(expect.objectContaining(line));
  });
});

describe("RUN_PRINTED_BLOCKS", () => {
  it("holds the synopsis, then the tool's help and the help of each of the six commands", () => {
    expect(RUN_PRINTED_BLOCKS).toHaveLength(8);
  });

  it("opens with the synopsis, which names upgrade and not split-records", () => {
    expect(RUN_PRINTED_BLOCKS[0]).toContain("hone upgrade --repo <dir>");
    expect(RUN_PRINTED_BLOCKS[0]).not.toContain("split-records");
  });
});

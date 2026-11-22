import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../node/path-port.ts";
import { readSelectionFile, selectionFilePathOf } from "./selection-reader.ts";

const FILE_TEXT = createDefaultFileTextPort({});

const PATH = createDefaultPathPort({});

const fixtureRoot = (name: string) => {
  const resolved = PATH.resolve({ path: PATH.join({ segments: [import.meta.dirname, "..", "content-files", "rule-sets", "team-rule-set", name] }) });
  assert(resolved.outcome === "ok", `${name} resolves to an absolute path`);
  return resolved.value;
};

const readFixture = (name: string) => {
  const path = selectionFilePathOf({ path: PATH, repoRoot: fixtureRoot(name) });
  return { path, reading: readSelectionFile({ fileText: FILE_TEXT, path }) };
};

describe("selectionFilePathOf", () => {
  it("is disciplines.json at the repository root", () => {
    const repoRoot = fixtureRoot("repo");
    expect(selectionFilePathOf({ path: PATH, repoRoot })).toBe(PATH.join({ segments: [repoRoot, "disciplines.json"] }));
  });
});

describe("readSelectionFile", () => {
  it("reads and parses the disciplines.json on disk into the selection file", () => {
    expect(readFixture("repo").reading).toMatchObject({
      outcome: "ok",
      value: {
        ruleSets: [["team", { location: "folder", path: "team-rules" }]],
        clauses: [[{ ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" }, { state: "run", mechanism: "walker" }]],
        exclude: ["vendor"],
      },
    });
  });

  it("is file-unreadable, naming the file, when no disciplines.json is on disk", () => {
    const { path, reading } = readFixture("install");
    expect(reading).toMatchObject({ outcome: "failed", error: { kind: "file-unreadable", path } });
  });
});

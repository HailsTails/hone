import { describe, expect, it } from "vitest";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { authoriseArgumentsFor, memoryRepositoryOf, recordedProcessWith } from "./command-harness.ts";

describe("memoryRepositoryOf", () => {
  const repository = memoryRepositoryOf({ files: { "hone-records/debt/a.json": "{}", "hone.config.json": "{}" } });

  it("lists a folder's entries, a file as a file and a nested folder as a directory", () => {
    expect(repository.directory.list({ path: absolutePathSchema.parse("/repo/hone-records") })).toEqual({ outcome: "ok", value: [{ name: "debt", kind: "directory" }] });
  });

  it("holds a file and a folder it holds a file under, and nothing else", () => {
    expect([repository.fileText.exists({ path: "/repo/hone.config.json" }), repository.fileText.exists({ path: "/repo/hone-records" }), repository.fileText.exists({ path: "/repo/other" })]).toEqual([
      "present",
      "present",
      "absent",
    ]);
  });

  it("holds a file outside the repository at the absolute path it is given", () => {
    const withOutsideFile = memoryRepositoryOf({ files: {}, outsideFiles: { "/install/package.json": "{}" } });

    expect(withOutsideFile.fileText.read({ path: "/install/package.json" })).toEqual({ outcome: "ok", value: "{}" });
  });

  it("writes a file where it can then be read, and removes it again", () => {
    repository.fileText.write({ path: "/repo/new.json", text: "[]" });
    expect(repository.textOf({ file: "new.json" })).toBe("[]");
    repository.removal.remove({ path: "/repo/new.json" });
    expect(repository.filesHeld()).toEqual(["hone-records/debt/a.json", "hone.config.json"]);
  });
});

describe("recordedProcessWith", () => {
  it("records what the process wrote out and the code it exited with, in call order", () => {
    const recorded = recordedProcessWith({ arguments: ["--repo", "/repo"] });
    recorded.port.writeOut({ text: "one\n" });
    recorded.port.exitWith({ code: 2 });
    expect({ arguments: recorded.port.arguments, writes: recorded.writes, exits: recorded.exits }).toEqual({
      arguments: ["--repo", "/repo"],
      writes: [[{ text: "one\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

describe("authoriseArgumentsFor", () => {
  const given = authoriseArgumentsFor({ repo: "/repo", rootCause: "a cause" });

  it("gives the repository, then the symptom, file, case and principle the form is for", () => {
    expect(given).toEqual(expect.arrayContaining(["--repo", "/repo", "--answers", "claimed-type", "--file", "src/a.ts", "--case", "gives-a-value-its-type", "--owes", "declared-not-asserted"]));
  });

  it("gives the root cause it was given", () => {
    expect(given).toEqual(expect.arrayContaining(["--root-cause", "a cause"]));
  });
});

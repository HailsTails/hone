import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { type LinesReader, linesReaderOf, sourceLinesFor } from "./source-lines.ts";

const FILE = repoPathSchema.parse("src/a.ts");

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const readerAnswering = (answer: ReturnType<LinesReader>) => vi.fn<LinesReader>().mockReturnValue(answer);

describe("sourceLinesFor", () => {
  it("reads no source for a file with no rule hit", () => {
    const readLines = readerAnswering({ outcome: "ok", value: ["first;"] });
    expect(sourceLinesFor({ file: FILE, ruleHits: [], readLines })).toEqual({ outcome: "ok", value: [] });
    expect(readLines).not.toHaveBeenCalled();
  });

  it("reads a file's source once however many rule hits it has", () => {
    const readLines = readerAnswering({ outcome: "ok", value: ["first;", "second;", "third;"] });
    expect(
      sourceLinesFor({
        file: FILE,
        ruleHits: [
          { clause: classSyntax, line: 1, column: 1 },
          { clause: classSyntax, line: 2, column: 1 },
          { clause: classSyntax, line: 3, column: 1 },
        ],
        readLines,
      }),
    ).toEqual({ outcome: "ok", value: ["first;", "second;", "third;"] });
    expect(readLines.mock.calls).toEqual([[{ file: FILE }]]);
  });

  it("passes on a source read that fails", () => {
    const readLines = readerAnswering({
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "EACCES" },
    });
    expect(
      sourceLinesFor({ file: FILE, ruleHits: [{ clause: classSyntax, line: 1, column: 1 }], readLines }),
    ).toEqual({ outcome: "failed", error: { kind: "file-unreadable", file: FILE, detail: "EACCES" } });
  });
});

describe("linesReaderOf", () => {
  it("reads the file under the repository root and splits it on every line break", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "ok",
      value: "first;\r\nsecond;\nthird;\rfourth;\u2028fifth;\u2029sixth;",
    });
    const fileText: FileTextPort = { read, exists: vi.fn<FileTextPort["exists"]>(), write: vi.fn<FileTextPort["write"]>() };
    const readLines = linesReaderOf({ fileText, path, repoRoot: absolutePathSchema.parse("/repo") });
    expect(readLines({ file: FILE })).toEqual({
      outcome: "ok",
      value: ["first;", "second;", "third;", "fourth;", "fifth;", "sixth;"],
    });
    expect(read.mock.calls).toEqual([[{ path: "/repo/src/a.ts" }]]);
  });

  it("reads a file it cannot read as file-unreadable, naming the file", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "unreadable", path: "/repo/src/a.ts", detail: "EACCES" },
      }),
      exists: vi.fn<FileTextPort["exists"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(linesReaderOf({ fileText, path, repoRoot: absolutePathSchema.parse("/repo") })({ file: FILE })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "EACCES" },
    });
  });
});

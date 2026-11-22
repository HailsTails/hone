import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { mentionsInText, versionOneMentionsOf } from "./version-one-mentions.ts";

const CI = repoPathOf(".github/workflows/ci.yml");

describe("mentionsInText", () => {
  it("names each line that holds a version 1 file name, once, by its line number", () => {
    expect(
      mentionsInText({
        file: CI,
        text: "run: hone check\nrun: cat disciplines.json disciplines.eslint.mjs\nname: x\ncp discipline-exceptions/a.json .\n",
      }),
    ).toEqual([
      { file: CI, line: 2 },
      { file: CI, line: 4 },
    ]);
  });

  it("names the assessment page", () => {
    expect(mentionsInText({ file: CI, text: "see disciplines.assessment.md" })).toEqual([
      { file: CI, line: 1 },
    ]);
  });

  it("names nothing in a file holding a NUL character", () => {
    expect(mentionsInText({ file: CI, text: "disciplines.json\u0000" })).toEqual([]);
  });

  it("names nothing in a file that mentions only version 2 names", () => {
    expect(mentionsInText({ file: CI, text: "hone.config.json\nhone-records\n" })).toEqual([]);
  });
});

describe("versionOneMentionsOf", () => {
  const REPO = absoluteRootOf("/repo");

  it("reads each tracked file outside the excluded folders and skips a file no longer there", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: '{ "files": ["disciplines.json"] }' })
      .mockReturnValueOnce({
        outcome: "failed",
        error: { kind: "unreadable", path: "/repo/disciplines.json", detail: "ENOENT" },
      });
    const join = vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce("/repo/package.json")
      .mockReturnValueOnce("/repo/disciplines.json");
    expect(
      versionOneMentionsOf({
        tracked: [
          repoPathOf("package.json"),
          repoPathOf("vendor/x.md"),
          repoPathOf("disciplines.json"),
        ],
        excluded: [repoPathOf("vendor")],
        repoRoot: REPO,
        fileText: { read },
        path: { join },
      }),
    ).toEqual([{ file: "package.json", line: 1 }]);
    expect(read.mock.calls).toEqual([
      [{ path: "/repo/package.json" }],
      [{ path: "/repo/disciplines.json" }],
    ]);
  });
});

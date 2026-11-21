import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import { misnamedLine } from "./misnamed-lines.ts";

const FILE = repoPathSchema.parse("src/a.ts");

describe("misnamedLine", () => {
  it("gives the file and line, the kind, the rule id the disable names, the version 2 id to write and the comment", () => {
    expect(
      misnamedLine({
        misnamed: {
          kind: "version-1-id",
          ruleId: "hone/no-class-authoring",
          file: FILE,
          line: 2,
          text: "// eslint-disable-next-line hone/no-class-authoring",
          replacedBy: ["hone/authored-class-or-this#class-keyword"],
        },
      }),
    ).toBe("src/a.ts:2 version-1-id hone/no-class-authoring write hone/authored-class-or-this#class-keyword // eslint-disable-next-line hone/no-class-authoring");
  });

  it("gives each version 2 id to write when a version 1 id is several checks", () => {
    expect(
      misnamedLine({
        misnamed: {
          kind: "version-1-id",
          ruleId: "hone/no-class-authoring",
          file: FILE,
          line: 2,
          text: "// eslint-disable-next-line hone/no-class-authoring",
          replacedBy: ["hone/a#first", "hone/a#second"],
        },
      }),
    ).toBe("src/a.ts:2 version-1-id hone/no-class-authoring write each of hone/a#first, hone/a#second // eslint-disable-next-line hone/no-class-authoring");
  });

  it("keeps a block comment that spans lines on one line", () => {
    expect(
      misnamedLine({
        misnamed: { kind: "names-no-check", ruleId: "hone/untyped-value#no-such-check", file: FILE, line: 5, text: "/* eslint-disable\nhone/untyped-value#no-such-check */" },
      }),
    ).toBe("src/a.ts:5 names-no-check hone/untyped-value#no-such-check /* eslint-disable\\nhone/untyped-value#no-such-check */");
  });
});

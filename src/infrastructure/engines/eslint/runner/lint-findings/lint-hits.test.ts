import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { CUT_MARK } from "../../../protocol/runner-module/snippet.ts";
import { hitsCutFrom, type LintedClause, lineSnippet, messageReadingOf } from "./lint-hits.ts";

const FILE = repoPathSchema.parse("src/a.ts");

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");

const abstractSyntax = clauseAddressSchema.parse("CD-14#abstract-syntax");

const FORTY_BUNDLED = "var a=1;var b=2;var c=3;var d=4;var e=5;";

const LIMIT_LONG_LINE = `${FORTY_BUNDLED}${FORTY_BUNDLED}${FORTY_BUNDLED}${FORTY_BUNDLED}${FORTY_BUNDLED}`;

const CLASS_SYNTAX: LintedClause = { ruleId: "hone/no-class-authoring", clause: { address: classSyntax } };

const ABSTRACT_SYNTAX: LintedClause = { ruleId: "hone/no-abstract-authoring", clause: { address: abstractSyntax } };

const SAME_RULE_ON_ABSTRACT_SYNTAX: LintedClause = {
  ruleId: "hone/no-class-authoring",
  clause: { address: abstractSyntax },
};

describe("messageReadingOf", () => {
  it("reads a selected rule's message as a rule hit at its line and column", () => {
    expect(
      messageReadingOf({
        file: FILE,
        messages: [{ ruleId: "hone/no-class-authoring", line: 3, column: 5, message: "classes are not authored" }],
        selected: [CLASS_SYNTAX, ABSTRACT_SYNTAX],
      }),
    ).toEqual({
      outcome: "ok",
      value: { ruleHits: [{ clause: classSyntax, line: 3, column: 5 }], nativeExceptions: [] },
    });
  });

  it("reads nothing from a rule no clause selects", () => {
    expect(
      messageReadingOf({
        file: FILE,
        messages: [{ ruleId: "no-unused-vars", line: 1, column: 1, message: "unused" }],
        selected: [CLASS_SYNTAX],
      }),
    ).toEqual({ outcome: "ok", value: { ruleHits: [], nativeExceptions: [] } });
  });

  it("reads a rule that two clauses select as a hit for the first of them", () => {
    expect(
      messageReadingOf({
        file: FILE,
        messages: [{ ruleId: "hone/no-class-authoring", line: 2, column: 1, message: "classes are not authored" }],
        selected: [CLASS_SYNTAX, SAME_RULE_ON_ABSTRACT_SYNTAX],
      }),
    ).toEqual({
      outcome: "ok",
      value: { ruleHits: [{ clause: classSyntax, line: 2, column: 1 }], nativeExceptions: [] },
    });
  });

  it("reads an inline disable naming a rule as a native exception on that rule's clause", () => {
    expect(
      messageReadingOf({
        file: FILE,
        messages: [
          {
            ruleId: "hone-core/inline-config",
            messageId: "inline-disable",
            line: 4,
            column: 1,
            message: "// eslint-disable-next-line hone/no-class-authoring",
          },
        ],
        selected: [CLASS_SYNTAX, ABSTRACT_SYNTAX],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        ruleHits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: classSyntax,
            file: FILE,
            line: 4,
            text: "// eslint-disable-next-line hone/no-class-authoring",
            reach: "one-clause",
          },
        ],
      },
    });
  });

  it("reads an inline disable naming no rule as a native exception on every selected clause", () => {
    expect(
      messageReadingOf({
        file: FILE,
        messages: [
          {
            ruleId: "hone-core/inline-config",
            messageId: "inline-disable",
            line: 1,
            column: 1,
            message: "/* eslint-disable */",
          },
        ],
        selected: [CLASS_SYNTAX, ABSTRACT_SYNTAX],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        ruleHits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: classSyntax,
            file: FILE,
            line: 1,
            text: "/* eslint-disable */",
            reach: "every-selected-clause",
          },
          {
            kind: "inline-disable",
            clause: abstractSyntax,
            file: FILE,
            line: 1,
            text: "/* eslint-disable */",
            reach: "every-selected-clause",
          },
        ],
      },
    });
  });

  it("reads an inline rule configuration as a native exception on the configured rule's clause", () => {
    expect(
      messageReadingOf({
        file: FILE,
        messages: [
          {
            ruleId: "hone-core/inline-config",
            messageId: "inline-rule-config",
            line: 1,
            column: 1,
            message: '/* eslint hone/no-class-authoring: "off" */',
          },
        ],
        selected: [CLASS_SYNTAX, ABSTRACT_SYNTAX],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        ruleHits: [],
        nativeExceptions: [
          {
            kind: "inline-rule-config",
            clause: classSyntax,
            file: FILE,
            line: 1,
            text: '/* eslint hone/no-class-authoring: "off" */',
          },
        ],
      },
    });
  });

  it("fails as tool-failed on an inline-config message it cannot read, naming the file", () => {
    expect(
      messageReadingOf({
        file: FILE,
        messages: [
          {
            ruleId: "hone-core/inline-config",
            messageId: "inline-config-unreadable",
            line: 1,
            column: 1,
            message: "inline configuration comments could not be read",
          },
        ],
        selected: [CLASS_SYNTAX],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "src/a.ts: inline configuration comments could not be read" },
    });
  });

  it("gathers rule hits and native exceptions across a file's messages in message order", () => {
    expect(
      messageReadingOf({
        file: FILE,
        messages: [
          { ruleId: "hone/no-abstract-authoring", line: 1, column: 1, message: "abstract" },
          {
            ruleId: "hone-core/inline-config",
            messageId: "inline-disable",
            line: 2,
            column: 1,
            message: "// eslint-disable-next-line hone/no-class-authoring",
          },
          { ruleId: "hone/no-class-authoring", line: 5, column: 3, message: "class" },
        ],
        selected: [CLASS_SYNTAX, ABSTRACT_SYNTAX],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        ruleHits: [
          { clause: abstractSyntax, line: 1, column: 1 },
          { clause: classSyntax, line: 5, column: 3 },
        ],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: classSyntax,
            file: FILE,
            line: 2,
            text: "// eslint-disable-next-line hone/no-class-authoring",
            reach: "one-clause",
          },
        ],
      },
    });
  });
});

describe("lineSnippet", () => {
  it("trims a line within the snippet limit", () => {
    expect(lineSnippet({ line: "    class Widget {}  ", column: 5 })).toBe("class Widget {}");
  });

  it("cuts a line past the snippet limit at the column, behind the cut mark", () => {
    expect(lineSnippet({ line: `  ${LIMIT_LONG_LINE}class Flagged {}`, column: 203 })).toBe(`${CUT_MARK}class Flagged {}`);
  });
});

describe("hitsCutFrom", () => {
  it("anchors each rule hit at its line and zero-based column, with the snippet cut from its line", () => {
    expect(
      hitsCutFrom({
        file: FILE,
        ruleHits: [
          { clause: classSyntax, line: 1, column: 1 },
          { clause: abstractSyntax, line: 2, column: 3 },
        ],
        lines: ["class Widget {}", "  abstract class Shape {}"],
      }),
    ).toEqual([
      { clause: classSyntax, file: FILE, anchor: { line: 1, column: 0 }, snippet: "class Widget {}" },
      { clause: abstractSyntax, file: FILE, anchor: { line: 2, column: 2 }, snippet: "abstract class Shape {}" },
    ]);
  });

  it("cuts the empty snippet for a hit on a line past the end of the source", () => {
    expect(
      hitsCutFrom({ file: FILE, ruleHits: [{ clause: classSyntax, line: 3, column: 1 }], lines: ["first;"] }),
    ).toEqual([{ clause: classSyntax, file: FILE, anchor: { line: 3, column: 0 }, snippet: "" }]);
  });
});

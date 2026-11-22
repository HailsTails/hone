import { describe, expect, it } from "vitest";

import { MISNAMED_DISABLE_RULE_ID, misnamedCommentsIn } from "./misnamed-disable-rule.ts";

const CHECK_RULE_IDS = ["hone/untyped-value#explicit-any"];

const LOC = { start: { line: 2, column: 0 }, end: { line: 2, column: 40 } };

const V1_ID = {
  type: "Line",
  value: " eslint-disable-next-line hone/no-class-authoring",
  loc: LOC,
};

const OWN_CHECK = {
  type: "Line",
  value: " eslint-disable-next-line hone/untyped-value#explicit-any",
  loc: LOC,
};

const OTHER_PLUGIN = { type: "Block", value: " eslint-disable no-console ", loc: LOC };

const NO_CHECK_IN_A_LIST = {
  type: "Block",
  value: " eslint-disable no-console, hone/untyped-value#not-a-check ",
  loc: LOC,
};

describe("MISNAMED_DISABLE_RULE_ID", () => {
  it("is a rule of the tool's own namespace", () => {
    expect(MISNAMED_DISABLE_RULE_ID).toBe("hone/misnamed-disable");
  });
});

describe("misnamedCommentsIn", () => {
  it("gives a comment that names an id of the tool's namespace that names no check, with the comment's text", () => {
    expect(misnamedCommentsIn({ nodes: [V1_ID], checkRuleIds: CHECK_RULE_IDS })).toEqual([
      { comment: V1_ID, text: "// eslint-disable-next-line hone/no-class-authoring" },
    ]);
  });

  it("gives a block comment whose list holds one such id beside another plugin's rule", () => {
    expect(
      misnamedCommentsIn({ nodes: [NO_CHECK_IN_A_LIST], checkRuleIds: CHECK_RULE_IDS }),
    ).toEqual([
      {
        comment: NO_CHECK_IN_A_LIST,
        text: "/* eslint-disable no-console, hone/untyped-value#not-a-check */",
      },
    ]);
  });

  it("gives nothing for a comment that names a check's id or another plugin's rule", () => {
    expect(
      misnamedCommentsIn({ nodes: [OWN_CHECK, OTHER_PLUGIN], checkRuleIds: CHECK_RULE_IDS }),
    ).toEqual([]);
  });

  it("gives nothing when the inline configuration nodes cannot be read", () => {
    expect(
      misnamedCommentsIn({ nodes: [{ type: "Other" }], checkRuleIds: CHECK_RULE_IDS }),
    ).toEqual([]);
  });

  it("gives nothing when the file has no inline configuration nodes to ask for", () => {
    expect(misnamedCommentsIn({ nodes: undefined, checkRuleIds: CHECK_RULE_IDS })).toEqual([]);
  });
});

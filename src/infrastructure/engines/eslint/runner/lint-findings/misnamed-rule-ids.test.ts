import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { LintedMessage } from "../toolchain/eslint-instance.ts";
import { MISNAMED_DISABLE_RULE_ID } from "./misnamed-disable-rule.ts";
import { misnamedRuleIdsIn } from "./misnamed-rule-ids.ts";

const FILE = repoPathOf("src/kept.ts");

const CHECK_RULE_IDS = ["hone/untyped-value#explicit-any"];

const VERSION_ONE_RULE_IDS = [
  { ruleId: "hone/no-explicit-any", replacedBy: ["hone/untyped-value#explicit-any"] },
  { ruleId: "hone/no-implicit-any", replacedBy: [] },
];

const commentOn = (request: {
  readonly line: number;
  readonly message: string;
}): LintedMessage => ({
  ruleId: MISNAMED_DISABLE_RULE_ID,
  messageId: "misnamed",
  line: request.line,
  column: 1,
  message: request.message,
});

const misnamedIn = (request: { readonly messages: readonly LintedMessage[] }) =>
  misnamedRuleIdsIn({
    file: FILE,
    messages: request.messages,
    checkRuleIds: CHECK_RULE_IDS,
    versionOneRuleIds: VERSION_ONE_RULE_IDS,
  });

describe("misnamedRuleIdsIn", () => {
  it("names a version 1 id as a version 1 id, with its file, line and comment and the version 2 id of its check", () => {
    expect(
      misnamedIn({
        messages: [
          commentOn({ line: 4, message: "// eslint-disable-next-line hone/no-explicit-any" }),
        ],
      }),
    ).toEqual([
      {
        kind: "version-1-id",
        ruleId: "hone/no-explicit-any",
        file: "src/kept.ts",
        line: 4,
        text: "// eslint-disable-next-line hone/no-explicit-any",
        replacedBy: ["hone/untyped-value#explicit-any"],
      },
    ]);
  });

  it("names a version 1 id whose check version 2 does not run on ESLint as naming no check", () => {
    expect(
      misnamedIn({
        messages: [
          commentOn({ line: 3, message: "// eslint-disable-next-line hone/no-implicit-any" }),
        ],
      }),
    ).toEqual([
      {
        kind: "names-no-check",
        ruleId: "hone/no-implicit-any",
        file: "src/kept.ts",
        line: 3,
        text: "// eslint-disable-next-line hone/no-implicit-any",
      },
    ]);
  });

  it("names an id of the tool's namespace that no version 1 piece and no check holds as naming no check", () => {
    expect(
      misnamedIn({
        messages: [
          commentOn({ line: 2, message: "/* eslint-disable hone/untyped-value#no-such */" }),
        ],
      }),
    ).toEqual([
      {
        kind: "names-no-check",
        ruleId: "hone/untyped-value#no-such",
        file: "src/kept.ts",
        line: 2,
        text: "/* eslint-disable hone/untyped-value#no-such */",
      },
    ]);
  });

  it("names the id of a check written with a slash between its symptom and its name as naming no check", () => {
    expect(
      misnamedIn({
        messages: [
          commentOn({
            line: 6,
            message: "// eslint-disable-next-line hone/untyped-value/explicit-any -- legacy",
          }),
        ],
      }),
    ).toEqual([
      {
        kind: "names-no-check",
        ruleId: "hone/untyped-value/explicit-any",
        file: "src/kept.ts",
        line: 6,
        text: "// eslint-disable-next-line hone/untyped-value/explicit-any -- legacy",
      },
    ]);
  });

  it("leaves out a check's own id and an id outside the tool's namespace, naming only the misnamed id of a list", () => {
    expect(
      misnamedIn({
        messages: [
          commentOn({
            line: 1,
            message: "/* eslint-disable hone/untyped-value#explicit-any, no-console, hone/gone */",
          }),
        ],
      }),
    ).toEqual([
      {
        kind: "names-no-check",
        ruleId: "hone/gone",
        file: "src/kept.ts",
        line: 1,
        text: "/* eslint-disable hone/untyped-value#explicit-any, no-console, hone/gone */",
      },
    ]);
  });

  it("reads only the messages of the misnamed-disable rule", () => {
    expect(
      misnamedIn({
        messages: [
          {
            ruleId: "hone/untyped-value#explicit-any",
            line: 1,
            column: 1,
            message: "// eslint-disable-next-line hone/gone",
          },
        ],
      }),
    ).toEqual([]);
  });
});

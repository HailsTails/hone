import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import { readRule } from "./selected-rule.ts";

describe("readRule", () => {
  it("uses the native binding without resolving an ESLint piece", () => {
    const selected = readRule({
      binding: {
        address: "positional-parameters#parameter-count",
        engine: "oxlint",
        ruleSet: TOOL_RULE_SET,
        anchor: { kind: "keyword", keyword: "function" },
        pieceRoot: "/hone/parameter-count",
        settings: { rule: "eslint/max-params", options: [{ max: 2, countVoidThis: true }] },
        checkSettings: {},
        edition: editionOf("1"),
      },
    });

    expect(selected).toEqual({
      outcome: "ok",
      value: {
        kind: "native",
        id: "eslint/max-params",
        options: [{ max: 2, countVoidThis: true }],
      },
    });
  });

  it("uses the selected edition and module from its own binding", () => {
    const selected = readRule({
      binding: {
        address: "test-switched-off#skipped-tests",
        engine: "oxlint",
        ruleSet: TOOL_RULE_SET,
        anchor: { kind: "keyword", keyword: "skip" },
        pieceRoot: "/hone/skipped-tests",
        settings: {
          rule: "skipped-tests",
          pluginNamespace: "hone-test-switched-off-focused-tests",
          module: "oxlint-plugin.ts",
          optionsByEdition: { "2": ["conditional-and-todo"] },
        },
        checkSettings: {},
        edition: editionOf("2"),
      },
    });

    expect(selected).toEqual({
      outcome: "ok",
      value: {
        kind: "plugin",
        id: "hone-test-switched-off-focused-tests/skipped-tests",
        namespace: "hone-test-switched-off-focused-tests",
        module: expect.stringMatching(/skipped-tests[/\\]oxlint-plugin\.ts$/u),
        options: ["conditional-and-todo"],
      },
    });
  });
});

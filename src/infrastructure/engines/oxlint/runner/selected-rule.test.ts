import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { readRule } from "./selected-rule.ts";

const path = createDefaultPathPort({});
const INSTALL_ROOT = path.join({ segments: [import.meta.dirname, "../../../../.."] });

describe("readRule", () => {
  it("uses edition options and the implementation module from the ESLint piece", () => {
    const selected = readRule({
      installRoot: INSTALL_ROOT,
      binding: {
        address: "test-switched-off#skipped-tests",
        engine: "oxlint",
        ruleSet: TOOL_RULE_SET,
        anchor: { kind: "keyword", keyword: "skip" },
        pieceRoot: "/hone/skipped-tests",
        settings: { plugin: "eslint" },
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
        module: expect.stringMatching(/focused-tests[/\\]eslint-plugin\.ts$/u),
        options: ["conditional-and-todo"],
      },
    });
  });
});

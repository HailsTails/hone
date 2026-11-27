import { describe, expect, it, vi } from "vitest";

import { isFunctionSite, readNode, type RuleContext, siteRule } from "./rule-sites.ts";

describe("readNode", () => {
  it("refuses a node whose range contains a non-number", () => {
    const syntax = { type: "Identifier", range: [0, "1"] };

    const node = readNode(syntax);

    expect(node).toBeUndefined();
  });

  it("keeps the parser's original node for reporting", () => {
    const syntax = { type: "Identifier", range: [0, 1] };

    const node = readNode(syntax);

    expect(node).toBe(syntax);
  });
});

describe("isFunctionSite", () => {
  it("requires a function body", () => {
    const syntax = { type: "ArrowFunctionExpression" };

    const isFunction = isFunctionSite(syntax);

    expect(isFunction).toBe(false);
  });
});

describe("siteRule", () => {
  it("registers the observed call event on the JavaScript rule", () => {
    const calls = vi.fn();
    const context: RuleContext = {
      filename: "value.ts",
      options: [],
      sourceCode: {
        text: "",
        visitorKeys: {},
        getFirstToken: vi.fn(),
        getTokenBefore: vi.fn(),
        getTokenAfter: vi.fn(),
        getTokens: vi.fn(),
        getNodeByRangeIndex: vi.fn(),
      },
      report: vi.fn(),
    };
    const rule = siteRule({
      meta: { type: "problem", docs: { description: "calls" }, schema: [], messages: {} },
      observe: () => ({ calls }),
    });

    const listeners = rule.create(context);

    expect(listeners["CallExpression"]).toBe(calls);
  });
});

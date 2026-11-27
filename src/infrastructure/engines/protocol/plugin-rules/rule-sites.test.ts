import { describe, expect, it, vi } from "vitest";

import { type RuleContext, siteRule } from "./rule-sites.ts";

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

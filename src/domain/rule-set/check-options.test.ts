import { describe, expect, it } from "vitest";

import { resolveCheckOptions } from "./check-options.ts";
import { TOOL_RULE_SET } from "./clause-address.ts";
import { editionOf } from "./edition-of.ts";
import { ruleSetNameOf } from "./rule-set-name-of.ts";

describe("resolveCheckOptions", () => {
  it("selects skipped-test coverage by edition", () => {
    const early = resolveCheckOptions({
      ruleSet: TOOL_RULE_SET,
      address: "test-switched-off#skipped-tests",
      edition: editionOf("1"),
    });
    const later = resolveCheckOptions({
      ruleSet: TOOL_RULE_SET,
      address: "test-switched-off#skipped-tests",
      edition: editionOf("12"),
    });

    expect(early).toEqual({
      ruleSet: TOOL_RULE_SET,
      checkOptions: { kind: "skipped-tests", coverage: "skips-and-fixmes" },
    });
    expect(later).toEqual({
      ruleSet: TOOL_RULE_SET,
      checkOptions: { kind: "skipped-tests", coverage: "including-conditional-and-todo" },
    });
  });

  it("leaves a team rule set's own parameter-count check to that rule set", () => {
    const ruleSet = { name: ruleSetNameOf("team") };

    const options = resolveCheckOptions({
      ruleSet,
      address: "positional-parameters#parameter-count",
      edition: editionOf("1"),
    });

    expect(options).toEqual({ ruleSet, checkOptions: { kind: "piece" } });
  });
});

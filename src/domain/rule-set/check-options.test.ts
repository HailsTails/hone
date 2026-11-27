import { describe, expect, it } from "vitest";

import { bindHoneCheckOptions } from "./check-options.ts";
import { TOOL_RULE_SET } from "./clause-address.ts";
import { editionOf } from "./edition-of.ts";
import { ruleSetNameOf } from "./rule-set-name-of.ts";

describe("bindHoneCheckOptions", () => {
  it("selects skipped-test coverage by edition", () => {
    const early = bindHoneCheckOptions({
      ruleSet: TOOL_RULE_SET,
      address: "test-switched-off#skipped-tests",
      edition: editionOf("1"),
    });
    const later = bindHoneCheckOptions({
      ruleSet: TOOL_RULE_SET,
      address: "test-switched-off#skipped-tests",
      edition: editionOf("12"),
    });

    expect(early).toEqual({
      checkOptions: { kind: "skipped-tests", coverage: "skips-and-fixmes" },
    });
    expect(later).toEqual({
      checkOptions: { kind: "skipped-tests", coverage: "including-conditional-and-todo" },
    });
  });

  it("leaves a team rule set's own parameter-count check to that rule set", () => {
    const ruleSet = { name: ruleSetNameOf("team") };

    const options = bindHoneCheckOptions({
      ruleSet,
      address: "positional-parameters#parameter-count",
      edition: editionOf("1"),
    });

    expect(options).toEqual({});
  });
});

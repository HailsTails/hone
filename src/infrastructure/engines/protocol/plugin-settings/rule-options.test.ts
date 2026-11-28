import { describe, expect, it } from "vitest";

import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import { optionsByEditionSchema, ruleOptionsOf } from "./rule-options.ts";

describe("ruleOptionsOf", () => {
  it("uses the latest options the requested edition reaches", () => {
    const settings = {
      options: ["base"],
      optionsByEdition: new Map([
        [editionOf("2"), ["edition-two"]],
        [editionOf("10"), ["edition-ten"]],
      ]),
    };

    const selected = ruleOptionsOf({ settings, edition: editionOf("11") });
    const defaultOptions = ruleOptionsOf({ settings, edition: editionOf("1") });

    expect(selected).toEqual(["edition-ten"]);
    expect(defaultOptions).toEqual(["base"]);
  });

  it("refuses a per-edition options key that is not an edition", () => {
    const parsed = optionsByEditionSchema.safeParse({ zero: [] });

    expect(parsed.success).toBe(false);
  });
});

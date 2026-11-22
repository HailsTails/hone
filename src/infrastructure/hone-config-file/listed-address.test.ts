import { describe, expect, it } from "vitest";
import { listedAddressSchema } from "./listed-address.ts";
import type { ListedAddress } from "../../domain/settings/listed-address.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";

describe("listedAddressSchema", () => {
  type ParsedRow = { readonly text: string; readonly address: ListedAddress };

  it.each<ParsedRow>([
    { text: "loop-keyword#loops", address: { ruleSet: "hone", check: "loop-keyword#loops" } },
    { text: "hone/loop-keyword#loops", address: { ruleSet: "hone", check: "loop-keyword#loops" } },
    { text: "team/no-tmp-file#tmp-paths", address: { ruleSet: { name: ruleSetNameOf("team") }, check: "no-tmp-file#tmp-paths" } },
  ])("reads $text as the check it names in its rule set", ({ text, address }) => {
    expect(listedAddressSchema.parse(text)).toEqual(address);
  });

  it.each<{ readonly text: string }>([{ text: "loop-keyword" }, { text: "a/b/loop-keyword#loops" }, { text: "loop-keyword#loops#again" }, { text: "#loops" }])(
    "refuses $text, which is not [<ruleSet>/]<symptom>#<check>",
    ({ text }) => {
      expect(listedAddressSchema.safeParse(text)).toMatchObject({
        success: false,
        error: { issues: [{ message: "is not a check address of the form [<ruleSet>/]<symptom>#<check>" }] },
      });
    },
  );
});

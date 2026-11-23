import { describe, expect, it } from "vitest";

import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import { type ListedAddress, listedAddressOf, listedAddressText } from "./listed-address.ts";

describe("listedAddressText", () => {
  it.each<{ readonly address: ListedAddress; readonly text: string }>([
    { address: { ruleSet: "hone", check: "loop-keyword#loops" }, text: "loop-keyword#loops" },
    {
      address: { ruleSet: { name: ruleSetNameOf("team") }, check: "no-tmp-file#tmp-paths" },
      text: "team/no-tmp-file#tmp-paths",
    },
  ])("writes $text", ({ address, text }) => {
    expect(listedAddressText({ address })).toBe(text);
  });
});

describe("listedAddressOf", () => {
  it("keeps a rule-set prefix separate from the named check", () => {
    expect(listedAddressOf({ text: "team/no-tmp-file#tmp-paths" })).toEqual({
      ruleSet: { name: ruleSetNameOf("team") },
      check: "no-tmp-file#tmp-paths",
    });
  });

  it("refuses an address whose check name is malformed", () => {
    expect(listedAddressOf({ text: "team/no-tmp-file#tmp--paths" })).toBeUndefined();
  });
});

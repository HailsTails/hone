import { describe, expect, it } from "vitest";
import { ruleSetNameSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { type ListedAddress, listedAddressText } from "./listed-address.ts";

describe("listedAddressText", () => {
  it.each<{ readonly address: ListedAddress; readonly text: string }>([
    { address: { ruleSet: "hone", check: "loop-keyword#loops" }, text: "loop-keyword#loops" },
    { address: { ruleSet: { name: ruleSetNameSchema.parse("team") }, check: "no-tmp-file#tmp-paths" }, text: "team/no-tmp-file#tmp-paths" },
  ])("writes $text", ({ address, text }) => {
    expect(listedAddressText({ address })).toBe(text);
  });
});

import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import {
  type ListedAddress,
  listedAddressOf,
  listedAddressText,
  sameListedAddress,
} from "./listed-address.ts";

describe("listedAddressText", () => {
  it.each<{ readonly address: ListedAddress; readonly text: string }>([
    {
      address: { ruleSet: TOOL_RULE_SET, check: "loop-keyword#loops" },
      text: "loop-keyword#loops",
    },
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

describe("listedAddressOf for Hone's own check", () => {
  it("reads an unprefixed address as Hone's own", () => {
    expect(listedAddressOf({ text: "loop-keyword#loops" })).toEqual({
      ruleSet: TOOL_RULE_SET,
      check: "loop-keyword#loops",
    });
  });

  it("refuses an address with more than one rule-set separator", () => {
    expect(listedAddressOf({ text: "team/extra/no-tmp-file#tmp-paths" })).toBeUndefined();
  });
});

describe("sameListedAddress", () => {
  it("holds one check in Hone's rule set and a team's different", () => {
    expect(
      sameListedAddress({
        left: { ruleSet: TOOL_RULE_SET, check: "loop-keyword#loops" },
        right: { ruleSet: { name: ruleSetNameOf("team") }, check: "loop-keyword#loops" },
      }),
    ).toBe("different");
  });

  it("holds one check of one rule set the same", () => {
    expect(
      sameListedAddress({
        left: { ruleSet: { name: ruleSetNameOf("team") }, check: "loop-keyword#loops" },
        right: { ruleSet: { name: ruleSetNameOf("team") }, check: "loop-keyword#loops" },
      }),
    ).toBe("same");
  });
});

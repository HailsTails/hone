import { describe, expect, it } from "vitest";

import {
  type OwnedName,
  ownedNameOf,
  ownedNameText,
  sameOwnedName,
  teamRuleSetOf,
} from "./rule-set-identity.ts";
import { ruleSetNameOf } from "./rule-set-name-of.ts";

const ACME = { name: ruleSetNameOf("acme") };

describe("ownedNameText", () => {
  it("gives a name of Hone's own rule set as it is", () => {
    expect(ownedNameText({ ruleSet: "hone", name: "claimed-type" })).toBe("claimed-type");
  });

  it("puts a team's rule set before its name", () => {
    expect(ownedNameText({ ruleSet: ACME, name: "claimed-type" })).toBe("acme/claimed-type");
  });
});

describe("sameOwnedName", () => {
  it("holds two names of one rule set the same", () => {
    expect(
      sameOwnedName({
        left: { ruleSet: ACME, name: "claimed-type" },
        right: { ruleSet: { name: ruleSetNameOf("acme") }, name: "claimed-type" },
      }),
    ).toBe("same");
  });

  it("holds one name in Hone's rule set and a team's different", () => {
    expect(
      sameOwnedName({
        left: { ruleSet: "hone", name: "claimed-type" },
        right: { ruleSet: ACME, name: "claimed-type" },
      }),
    ).toBe("different");
  });
});

describe("ownedNameOf", () => {
  it.each<readonly [string, OwnedName | "not-an-owned-name"]>([
    ["claimed-type#casts", { ruleSet: "hone", name: "claimed-type#casts" }],
    ["hone/claimed-type#casts", { ruleSet: "hone", name: "claimed-type#casts" }],
    ["acme/claimed-type#casts", { ruleSet: ACME, name: "claimed-type#casts" }],
    ["Acme/claimed-type", "not-an-owned-name"],
    ["acme/", "not-an-owned-name"],
    ["acme/claimed-type/casts", "not-an-owned-name"],
    ["a/b/c", "not-an-owned-name"],
    ["/x", "not-an-owned-name"],
  ])("reads %s", (text, owned) => {
    expect(ownedNameOf({ text })).toEqual(owned);
  });
});

describe("teamRuleSetOf", () => {
  it.each<readonly [string, { readonly name: string } | undefined]>([
    ["acme", { name: "acme" }],
    ["hone", undefined],
    ["Acme", undefined],
    ["acme/ui", undefined],
  ])("reads %s", (name, ruleSet) => {
    expect(teamRuleSetOf({ name })).toEqual(ruleSet);
  });
});

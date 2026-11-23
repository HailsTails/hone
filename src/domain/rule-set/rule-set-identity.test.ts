import { describe, expect, it } from "vitest";

import { ownedNameText, sameOwnedName } from "./rule-set-identity.ts";
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

import { expect, it } from "vitest";

import { RULE_SET_NAMES_SEGMENTS } from "./version-one-names-location.ts";

it("keeps a rule set's version 1 names in its rules folder, where the items are", () => {
  expect(RULE_SET_NAMES_SEGMENTS).toEqual(["rules", "version-one-names.json"]);
});

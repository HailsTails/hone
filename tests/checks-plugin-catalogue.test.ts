import { describe, expect, it } from "vitest";
import { checkAt } from "../src/domain/language-layer/check-address.ts";
import { CHECKS_PLUGIN_CATALOGUE } from "./checks-plugin-catalogue.ts";

describe("CHECKS_PLUGIN_CATALOGUE", () => {
  it.each<{ readonly address: string; readonly discipline: string; readonly clause: string }>([
    { address: "test-switched-off#skipped-tests", discipline: "CD-27", clause: "skipped-tests" },
    { address: "claimed-type#non-null-assertions", discipline: "CD-2", clause: "non-null-assertions" },
    { address: "positional-parameters#parameter-count", discipline: "CD-40", clause: "parameter-count" },
  ])("holds $address on ESLint, bound to $discipline#$clause", ({ address, discipline, clause }) => {
    expect(checkAt({ catalogue: CHECKS_PLUGIN_CATALOGUE, address })).toMatchObject({
      found: "check",
      check: { clause: { discipline, clause }, engines: [{ name: "eslint" }] },
    });
  });

  it("holds rebinding#test-body on the walker only", () => {
    expect(checkAt({ catalogue: CHECKS_PLUGIN_CATALOGUE, address: "rebinding#test-body" })).toMatchObject({
      found: "check",
      check: { engines: [{ name: "walker" }] },
    });
  });
});

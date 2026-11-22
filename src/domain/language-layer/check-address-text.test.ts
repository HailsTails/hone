import { describe, expect, it } from "vitest";

import { catalogueNameOf } from "./catalogue-name.ts";
import {
  CHECK_ADDRESS_SEPARATOR,
  checkAddressOfNames,
  checkAddressTextOf,
  checkNamesOf,
} from "./check-address-text.ts";

describe("checkAddressTextOf", () => {
  it("spells a check's address as its symptom, the address separator and its name", () => {
    expect(
      checkAddressTextOf({
        check: { name: "class-keyword", symptom: { name: "authored-class-or-this" } },
      }),
    ).toBe("authored-class-or-this#class-keyword");
  });

  it("uses the one address separator", () => {
    expect(CHECK_ADDRESS_SEPARATOR).toBe("#");
  });
});

describe("checkNamesOf", () => {
  it("reads both names from a check address", () => {
    expect(checkNamesOf({ text: "authored-class-or-this#class-keyword" })).toEqual({
      symptom: "authored-class-or-this",
      check: "class-keyword",
    });
  });

  it("formats the parsed names as a check address", () => {
    expect(
      checkAddressOfNames({
        symptom: catalogueNameOf("authored-class-or-this"),
        check: catalogueNameOf("class-keyword"),
      }),
    ).toBe("authored-class-or-this#class-keyword");
  });

  it("refuses a trailing segment", () => {
    expect(checkNamesOf({ text: "authored-class-or-this#class-keyword#extra" })).toBeUndefined();
  });
});

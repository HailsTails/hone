import { describe, expect, it } from "vitest";
import { CHECK_ADDRESS_SEPARATOR, checkAddressTextOf } from "./check-address-text.ts";

describe("checkAddressTextOf", () => {
  it("spells a check's address as its symptom, the address separator and its name", () => {
    expect(checkAddressTextOf({ check: { name: "class-keyword", symptom: { name: "authored-class-or-this" } } })).toBe("authored-class-or-this#class-keyword");
  });

  it("uses the one address separator", () => {
    expect(CHECK_ADDRESS_SEPARATOR).toBe("#");
  });
});

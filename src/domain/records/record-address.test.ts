import { describe, expect, it } from "vitest";
import { symptomNameOf } from "./record-address.ts";

describe("the symptom an address names", () => {
  it("is the whole address when it names a symptom alone", () => {
    expect(symptomNameOf({ address: "claimed-type" })).toBe("claimed-type");
  });

  it("is what comes before the check", () => {
    expect(symptomNameOf({ address: "claimed-type#cast-expressions" })).toBe("claimed-type");
  });
});

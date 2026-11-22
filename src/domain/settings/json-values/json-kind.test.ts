import { describe, expect, it } from "vitest";

import { jsonKindOf, sameJsonValue } from "./json-kind.ts";
import type { ReadonlyJsonValue } from "./json-value.ts";

type SamenessCase = {
  readonly name: string;
  readonly left: ReadonlyJsonValue;
  readonly right: ReadonlyJsonValue;
};

describe("jsonKindOf", () => {
  it.each([
    { sample: "a", kind: "string" },
    { sample: 1, kind: "number" },
    { sample: false, kind: "boolean" },
    { sample: null, kind: "null" },
    { sample: [], kind: "array" },
    { sample: {}, kind: "object" },
  ])("names $kind", ({ sample, kind }) => {
    expect(jsonKindOf({ value: sample })).toBe(kind);
  });
});

describe("sameJsonValue", () => {
  it.each<SamenessCase>([
    { name: "equal strings", left: "camelCase", right: "camelCase" },
    { name: "equal arrays", left: ["a", 1], right: ["a", 1] },
    {
      name: "objects with keys in another order",
      left: { a: 1, b: [null] },
      right: { b: [null], a: 1 },
    },
  ])("is same for $name", ({ left, right }) => {
    expect(sameJsonValue({ left, right })).toBe("same");
  });

  it.each<SamenessCase>([
    { name: "different strings", left: "camelCase", right: "PascalCase" },
    { name: "a number and its string", left: 1, right: "1" },
    { name: "arrays of different length", left: ["a"], right: ["a", "b"] },
    { name: "an object missing a key", left: { a: 1 }, right: { b: 1 } },
    { name: "an array and an object", left: [], right: {} },
  ])("is different for $name", ({ left, right }) => {
    expect(sameJsonValue({ left, right })).toBe("different");
  });

  it("is different for an absent value", () => {
    expect(sameJsonValue({ left: null, right: undefined })).toBe("different");
  });
});

import { describe, expect, it } from "vitest";
import { sameJsonValue } from "./same-json-value.ts";

const regexOption = /class/u;

const sharedArray = ["a"];

describe("sameJsonValue", () => {
  it.each([
    { label: "equal strings", left: "a", right: "a" },
    { label: "equal numbers", left: 2, right: 2 },
    { label: "null and null", left: null, right: null },
    { label: "equal arrays", left: [1, "a", [true]], right: [1, "a", [true]] },
    { label: "objects with keys in another order", left: { a: 1, b: { c: [2] } }, right: { b: { c: [2] }, a: 1 } },
    { label: "the same array", left: sharedArray, right: sharedArray },
    { label: "two not-a-numbers", left: Number.NaN, right: Number.NaN },
  ])("reads $label as the same", ({ left, right }) => {
    expect(sameJsonValue({ left, right })).toBe("same");
  });

  it.each([
    { label: "different strings", left: "a", right: "b" },
    { label: "a number and its string", left: 1, right: "1" },
    { label: "zero and negative zero", left: 0, right: -0 },
    { label: "arrays of different lengths", left: [1], right: [1, 1] },
    { label: "an array and an object", left: [], right: {} },
    { label: "objects with different keys", left: { a: 1 }, right: { b: 1 } },
    { label: "an object with an extra key", left: { a: 1 }, right: { a: 1, b: 2 } },
    { label: "the same regular expression", left: regexOption, right: regexOption },
    { label: "undefined and undefined", left: undefined, right: undefined },
    { label: "objects holding undefined", left: { a: undefined }, right: { a: undefined } },
    { label: "class instances", left: new Map(), right: new Map() },
  ])("reads $label as different", ({ left, right }) => {
    expect(sameJsonValue({ left, right })).toBe("different");
  });
});

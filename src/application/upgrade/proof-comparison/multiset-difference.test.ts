import { describe, expect, it } from "vitest";
import { multisetRemainderOf } from "./multiset-difference.ts";

describe("multisetRemainderOf", () => {
  it("leaves what the first list holds beyond the second, sorted", () => {
    expect(multisetRemainderOf({ from: ["b", "a", "c"], taking: ["c"] })).toEqual(["a", "b"]);
  });

  it("takes each key once per occurrence in the second list", () => {
    expect(multisetRemainderOf({ from: ["a", "a", "a"], taking: ["a", "a"] })).toEqual(["a"]);
  });

  it("ignores keys the first list does not hold", () => {
    expect(multisetRemainderOf({ from: ["a"], taking: ["b"] })).toEqual(["a"]);
  });

  it("leaves nothing when the second list holds everything", () => {
    expect(multisetRemainderOf({ from: ["a", "b"], taking: ["b", "a", "c"] })).toEqual([]);
  });
});

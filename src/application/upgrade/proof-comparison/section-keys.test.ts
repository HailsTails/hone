import { describe, expect, it } from "vitest";

import { joinedKey, uniqueKeys } from "./section-keys.ts";

describe("uniqueKeys", () => {
  it("keeps each key once, in the order first seen", () => {
    expect(uniqueKeys({ keys: ["b", "a", "b", "c", "a"] })).toEqual(["b", "a", "c"]);
  });
});

describe("joinedKey", () => {
  it("joins its parts with a space, numbers as their digits", () => {
    expect(joinedKey({ parts: ["src/a.ts", 3, "x"] })).toBe("src/a.ts 3 x");
  });
});

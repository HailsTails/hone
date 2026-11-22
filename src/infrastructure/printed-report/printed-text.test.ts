import { describe, expect, it } from "vitest";

import { counted, onOneLine, quoted } from "./printed-text.ts";

describe("onOneLine", () => {
  it("prints a line feed as \\n and a carriage return as \\r", () => {
    expect(onOneLine({ text: "one\r\ntwo" })).toBe("one\\r\\ntwo");
  });
});

describe("quoted", () => {
  it("prints text as a JSON string, on one line", () => {
    expect(quoted({ text: 'says "no"\nthen stops' })).toBe('"says \\"no\\"\\nthen stops"');
  });
});

describe("counted", () => {
  it.each([
    { count: 1, text: "1 debt record" },
    { count: 0, text: "0 debt records" },
    { count: 2, text: "2 debt records" },
  ])("counts $count of a noun", ({ count, text }) => {
    expect(counted({ count, noun: "debt record" })).toBe(text);
  });
});

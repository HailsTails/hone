import { describe, expect, it } from "vitest";
import { itemTextOf } from "./item-text.ts";

describe("itemTextOf", () => {
  it("gives the first heading as the title and the one fenced json block as the facts, ignoring the prose", () => {
    const text = '# Date used directly\n\n```json\n{ "seen": "Any use of Date." }\n```\n\nWhy this matters, which is for people.\n';
    expect(itemTextOf({ text })).toEqual({ outcome: "ok", value: { title: "Date used directly", facts: { seen: "Any use of Date." } } });
  });

  it("reads a file with Windows line endings", () => {
    expect(itemTextOf({ text: '# Debt\r\n\r\n```json\r\n{ "phrase": "debt" }\r\n```\r\n' })).toEqual({
      outcome: "ok",
      value: { title: "Debt", facts: { phrase: "debt" } },
    });
  });

  it("skips a fenced block of another language, even one that holds a heading line", () => {
    expect(itemTextOf({ text: "# Debt\n\n```json\n{}\n```\n\n```ts\n# not a title\nconst a = 1;\n```\n" })).toEqual({
      outcome: "ok",
      value: { title: "Debt", facts: {} },
    });
  });

  it.each<{ readonly name: string; readonly text: string; readonly refusal: string }>([
    { name: "a file with no heading first", text: "Some prose\n\n```json\n{}\n```\n", refusal: "does not start with a title line, # <title>" },
    { name: "a heading with no title", text: "# \n\n```json\n{}\n```\n", refusal: "does not start with a title line, # <title>" },
    { name: "a file with no json block", text: "# Debt\n\nOnly prose.\n", refusal: "holds no fenced json block of facts" },
    { name: "a file with two json blocks", text: "# Debt\n\n```json\n{}\n```\n\n```json\n{}\n```\n", refusal: "holds more than one fenced json block; the facts are one block" },
    { name: "a block that is never closed", text: "# Debt\n\n```json\n{}\n", refusal: "has a fenced block that is never closed" },
  ])("refuses $name", ({ text, refusal }) => {
    expect(itemTextOf({ text })).toEqual({ outcome: "failed", error: refusal });
  });

  it("refuses facts that are not JSON, naming the parse failure", () => {
    expect(itemTextOf({ text: "# Debt\n\n```json\n{ nope\n```\n" })).toEqual({ outcome: "failed", error: expect.stringMatching(/^has facts that are not JSON: /) });
  });
});

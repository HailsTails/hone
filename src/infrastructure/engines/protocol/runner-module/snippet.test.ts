import { describe, expect, it } from "vitest";
import { SNIPPET_LIMIT, snippetSchema } from "./snippet.ts";

const FORTY = "0123456789012345678901234567890123456789";

const AT_LIMIT = `${FORTY}${FORTY}${FORTY}${FORTY}${FORTY}`;

const ONE_SHORT_OF_LIMIT = `${FORTY}${FORTY}${FORTY}${FORTY}012345678901234567890123456789012345678`;

describe("snippetSchema", () => {
  it("keeps a snippet of up to the limit unchanged", () => {
    expect(snippetSchema.parse(AT_LIMIT)).toBe(AT_LIMIT);
  });

  it("cuts a longer snippet to the limit and marks the cut with an ellipsis", () => {
    expect(snippetSchema.parse(`${AT_LIMIT}tail`)).toBe(`${AT_LIMIT}…`);
  });

  it("cuts on a character boundary, never inside a character outside the basic plane", () => {
    expect(snippetSchema.parse(`${ONE_SHORT_OF_LIMIT}😀tail`)).toBe(`${ONE_SHORT_OF_LIMIT}😀…`);
  });

  it("counts a character outside the basic plane once toward the limit", () => {
    expect(snippetSchema.parse(`${ONE_SHORT_OF_LIMIT}😀`)).toBe(`${ONE_SHORT_OF_LIMIT}😀`);
  });

  it("sets the limit at 200 characters", () => {
    expect(SNIPPET_LIMIT).toBe(200);
  });

  it("refuses a snippet that is not text", () => {
    expect(snippetSchema.safeParse(7).success).toBe(false);
  });
});

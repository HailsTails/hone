import { describe, expect, it } from "vitest";

import { compactSourceSnippetOf, sourceSnippetOf } from "./source-snippet.ts";

describe("source snippets", () => {
  it("joins lines while retaining spaces within the source", () => {
    expect(sourceSnippetOf('read(\r\n  "two  spaces");')).toBe('read( "two  spaces");');
  });

  it("compacts existing statement snippets with their original whitespace policy", () => {
    expect(compactSourceSnippetOf("let  value\n   = input;")).toBe("let value = input;");
  });

  it("keeps eighty source characters before the ellipsis", () => {
    expect(
      sourceSnippetOf(
        "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345",
      ),
    ).toBe("12345678901234567890123456789012345678901234567890123456789012345678901234567890…");
  });
});

import { describe, expect, it } from "vitest";

import { compactSourceSnippetOf, sourceSnippetAt, sourceSnippetOf } from "./source-snippet.ts";

describe("source snippets", () => {
  it("starts an anchored snippet at its offset and preserves the old spacing", () => {
    expect(sourceSnippetAt({ source: "prefix: line  one\r\n  line two", position: 8 })).toBe(
      "line  one\r   line two",
    );
  });

  it("ends anchored snippets with an ellipsis even at exactly eighty characters", () => {
    expect(
      sourceSnippetAt({
        source: "x12345678901234567890123456789012345678901234567890123456789012345678901234567890",
        position: 1,
      }),
    ).toBe("12345678901234567890123456789012345678901234567890123456789012345678901234567890…");
  });

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

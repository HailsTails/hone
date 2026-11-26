import { describe, expect, it } from "vitest";

import { eslintBoundary } from "./eslint-9-boundary.ts";

describe("the ESLint 9 boundary", () => {
  it("asks for the nearest-to-file lookup by the flag ESLint 9 names for it", () => {
    expect(eslintBoundary.nearestLookup).toEqual({ flags: ["v10_config_lookup_from_file"] });
  });

  it("reads a report's data that holds only texts and numbers as it stands", () => {
    expect(
      eslintBoundary.reportDataOf({
        descriptor: { loc: { line: 1, column: 0 }, messageId: "a", data: { text: "x", count: 2 } },
      }),
    ).toEqual({
      text: "x",
      count: 2,
    });
  });

  it("reads a report's data value that is no text, number or flag as the text ESLint 9 would show for it", () => {
    expect(
      eslintBoundary.reportDataOf({
        descriptor: { loc: { line: 1, column: 0 }, messageId: "a", data: { nested: {} } },
      }),
    ).toEqual({
      nested: "[object Object]",
    });
  });

  it("types the projection as the list of configuration blocks Hone writes, importing no package", () => {
    expect(eslintBoundary.projectionTypeText).toBe(`{
  name: string;
  files: string[];
  ignores?: string[];
  plugins?: Record<string, object>;
  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;
}[]`);
  });

  it("reads a report without data as having none", () => {
    expect(
      eslintBoundary.reportDataOf({ descriptor: { loc: { line: 1, column: 0 }, messageId: "a" } }),
    ).toBeUndefined();
  });
});

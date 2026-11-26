import { describe, expect, it } from "vitest";

import { PROJECTION_TYPE_TEXT } from "./eslint-major-boundary.ts";

describe("PROJECTION_TYPE_TEXT", () => {
  it("types the projection as the list of configuration blocks Hone writes, importing no package", () => {
    expect(PROJECTION_TYPE_TEXT).toBe(`{
  name: string;
  files: string[];
  ignores?: string[];
  plugins?: Record<string, object>;
  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;
}[]`);
  });
});

import { describe, expect, it } from "vitest";

import { PROJECTION_DECLARATION_TEXT, PROJECTION_TYPE_TEXT } from "./eslint-major-boundary.ts";

describe("PROJECTION_DECLARATION_TEXT", () => {
  it("wraps the same type used by the TypeScript projection as a module declaration", () => {
    expect(PROJECTION_DECLARATION_TEXT).toBe(
      `declare const projection: ${PROJECTION_TYPE_TEXT};\nexport default projection;\n`,
    );
  });
  it("declares the projection as the list of configuration blocks Hone writes, importing no package", () => {
    expect(PROJECTION_DECLARATION_TEXT).toBe(`declare const projection: {
  name: string;
  files: string[];
  ignores?: string[];
  plugins?: Record<string, object>;
  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;
}[];
export default projection;
`);
  });
});

import { describe, expect, it } from "vitest";
import { folderScope } from "./audit.ts";

describe("the audit entry's folderScope", () => {
  it("calls a file under a generated folder generated", () => {
    expect(folderScope({ file: "packages/web/node_modules/astro/styles.css" })).toBe("generated");
  });

  it("calls a file under the root vendor folder generated", () => {
    expect(folderScope({ file: "vendor/lib/index.ts" })).toBe("generated");
  });

  it("calls any other file authored", () => {
    expect(folderScope({ file: "apps/storefront/src/theme.css" })).toBe("authored");
  });
});

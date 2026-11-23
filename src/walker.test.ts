import { describe, expect, it } from "vitest";

import { DEFAULT_TEST_FILES, folderScope, isRuleSetName } from "./walker.ts";

describe("the walker entry's folderScope", () => {
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

describe("the walker entry's isRuleSetName", () => {
  it("accepts a lowercase name a team gives its rule set", () => {
    expect(isRuleSetName("acme-web")).toBe(true);
  });

  it("refuses a name that does not start with a lowercase letter", () => {
    expect(isRuleSetName("Acme")).toBe(false);
  });
});

describe("the walker entry's DEFAULT_TEST_FILES", () => {
  it("counts .test and .spec files as tests, under no folder", () => {
    expect(DEFAULT_TEST_FILES).toEqual({ suffixes: ["test", "spec"], folders: [] });
  });
});

import { describe, expect, it } from "vitest";
import { NESTED_CONFIGURATION_ISSUE } from "./nested-configuration-issue.ts";

describe("NESTED_CONFIGURATION_ISSUE", () => {
  it("is the tool's issue about nested configurations, in the tool's own repository", () => {
    expect(NESTED_CONFIGURATION_ISSUE).toBe("https://github.com/HailsTails/hone/issues/72");
  });
});

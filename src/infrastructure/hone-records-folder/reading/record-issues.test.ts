import { describe, expect, it } from "vitest";

import { mapZodIssuesToRecordIssues } from "./record-issues.ts";

describe("mapZodIssuesToRecordIssues", () => {
  it("keeps each issue's path and message, writing a symbol key as its text", () => {
    const issues = mapZodIssuesToRecordIssues({
      issues: [
        {
          code: "invalid_type",
          expected: "string",
          input: undefined,
          path: ["records", 0, Symbol.for("site")],
          message: "expected a site",
        },
      ],
    });

    expect(issues).toEqual([{ path: ["records", 0, "Symbol(site)"], message: "expected a site" }]);
  });
});

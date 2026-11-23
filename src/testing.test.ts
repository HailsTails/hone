import { describe, expect, it } from "vitest";

import { checkUnderTestOf, repoPathOf } from "./testing.ts";

describe("testing.ts, the conformance API wired over the default ports", () => {
  it("accepts a repository path and refuses an absolute one", () => {
    expect([repoPathOf({ file: "src/a.ts" }), repoPathOf({ file: "/abs/a.ts" })]).toEqual([
      { outcome: "ok", value: "src/a.ts" },
      { outcome: "failed", error: { kind: "file-invalid", detail: "/abs/a.ts" } },
    ]);
  });

  it("refuses a team rule set named as Hone's own before reading its root", () => {
    expect(
      checkUnderTestOf({
        ruleSet: { name: "hone", root: "tools/acme" },
        check: "scratch-file#scratch-files",
        engine: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        detail:
          "hone is not a team rule set name: use lower-case letters, digits and hyphens, and not hone",
      },
    });
  });
});

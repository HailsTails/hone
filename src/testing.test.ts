import { assert, describe, expect, it } from "vitest";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { clauseConformanceOf, clauseUnderTestOf, repoPathOf } from "./testing.ts";

const path = createDefaultPathPort({});

const RULE_SET_ROOT = path.join({ segments: [import.meta.dirname, ".."] });

describe("testing.ts, the conformance API wired over the default ports", () => {
  it("refuses a clause address it cannot read, as address-invalid with the text it was given", () => {
    expect(clauseUnderTestOf({ ruleSetRoot: RULE_SET_ROOT, clause: "not an address" })).toEqual({
      outcome: "failed",
      error: { kind: "address-invalid", detail: "not an address" },
    });
  });

  it("binds an audit clause of the shipped rules, reading the rule-set files from disk", () => {
    const bound = clauseUnderTestOf({ ruleSetRoot: RULE_SET_ROOT, clause: "CD-5#comments-directives" });

    assert(bound.outcome === "ok", "the shipped audit clause binds");
    expect(bound.value.clause.pieceRoot).toBe(path.join({ segments: [import.meta.dirname, "infrastructure", "engines", "audit", "CD-5"] }));
  });

  it("refuses a clause the shipped rules do not hold as not mechanical", async () => {
    await expect(clauseConformanceOf({ ruleSetRoot: RULE_SET_ROOT, clause: "CD-5#no-such-clause" })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "clause-not-mechanical", detail: "CD-5#no-such-clause" },
    });
  });

  it("accepts a repository path and refuses an absolute one", () => {
    expect([repoPathOf({ file: "src/a.ts" }), repoPathOf({ file: "/abs/a.ts" })]).toEqual([
      { outcome: "ok", value: "src/a.ts" },
      { outcome: "failed", error: { kind: "file-invalid", detail: "/abs/a.ts" } },
    ]);
  });
});

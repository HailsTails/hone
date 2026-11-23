import { describe, expect, it } from "vitest";

import { repoPathOf } from "./testing.ts";

describe("testing.ts, the conformance API wired over the default ports", () => {
  it("accepts a repository path and refuses an absolute one", () => {
    expect([repoPathOf({ file: "src/a.ts" }), repoPathOf({ file: "/abs/a.ts" })]).toEqual([
      { outcome: "ok", value: "src/a.ts" },
      { outcome: "failed", error: { kind: "file-invalid", detail: "/abs/a.ts" } },
    ]);
  });
});

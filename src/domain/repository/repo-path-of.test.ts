import { describe, expect, it } from "vitest";
import { isRepoPath } from "./repo-path.ts";
import { repoPathOf } from "./repo-path-of.ts";

describe("repoPathOf", () => {
  it.each(["a.ts", "src/a.ts", "src/[id].ts", "hone-records/debt", "a..b.ts"] as const)("returns %s unchanged", (text) => {
    expect(repoPathOf(text)).toBe(text);
  });

  it("returns text the repo-path guard accepts", () => {
    expect(isRepoPath(repoPathOf("src/a.ts"))).toBe(true);
  });
});

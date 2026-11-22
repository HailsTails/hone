import { describe, expect, it } from "vitest";
import { fixedRepoPath, isRepoPathText } from "./repo-path.ts";

const ACCEPTED = [
  "a.ts",
  "src/a.ts",
  "é.ts",
  "src/.hidden/a.ts",
  "a..b.ts",
  "packages/hone/core/values/repo-path.ts",
];

const REFUSED = [
  "",
  "/a.ts",
  "/home/user/repo/a.ts",
  ".",
  "..",
  "./a.ts",
  "a/./b.ts",
  "a/.",
  "../a.ts",
  "a/../b.ts",
  "a/..",
  "a//b.ts",
  "a/",
  "a\\b.ts",
  "C:\\repo\\a.ts",
  "C:/x",
  "c:/x",
  "C:x",
  "C:",
  "a\nb.ts",
  "a\rb.ts",
  "a\u0000b.ts",
  "src/a.ts\n",
];

describe("isRepoPathText", () => {
  it.each(ACCEPTED)("is repo-path for %j", (text) => {
    expect(isRepoPathText({ text })).toBe("repo-path");
  });

  it.each(REFUSED)("is not-repo-path for %j", (text) => {
    expect(isRepoPathText({ text })).toBe("not-repo-path");
  });
});

describe("fixedRepoPath", () => {
  it("returns a repo-relative path as given", () => {
    expect(fixedRepoPath("hone-records/debt")).toBe("hone-records/debt");
  });

  it("throws for a path that is not repo-relative", () => {
    expect(() => fixedRepoPath("../outside")).toThrow("../outside: not a repo-relative path");
  });
});

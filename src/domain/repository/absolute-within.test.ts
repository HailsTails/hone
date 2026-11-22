import { describe, expect, it } from "vitest";
import { isAbsolutePath } from "./absolute-path.ts";
import { absoluteRootOf } from "./absolute-root-of.ts";
import { absoluteWithin } from "./absolute-within.ts";
import { repoPathOf } from "./repo-path-of.ts";

describe("absoluteWithin", () => {
  it("places a repo path under a posix root", () => {
    expect(absoluteWithin({ root: absoluteRootOf("/repo"), file: repoPathOf("src/a.ts") })).toBe("/repo/src/a.ts");
  });

  it("places a repo path under a root with a trailing slash", () => {
    expect(absoluteWithin({ root: absoluteRootOf("/repo/"), file: repoPathOf("a.ts") })).toBe("/repo/a.ts");
  });

  it("places a repo path under a drive root written with forward slashes", () => {
    expect(absoluteWithin({ root: absoluteRootOf("C:/repo"), file: repoPathOf("src/a.ts") })).toBe("C:/repo/src/a.ts");
  });

  it("places a repo path under a drive root written with backslashes, in backslashes", () => {
    expect(absoluteWithin({ root: absoluteRootOf("C:\\repo"), file: repoPathOf("src/a.ts") })).toBe("C:\\repo\\src\\a.ts");
  });

  it("returns text the absolute-path guard accepts", () => {
    expect(isAbsolutePath(absoluteWithin({ root: absoluteRootOf("/repo"), file: repoPathOf("a.ts") }))).toBe(true);
  });
});

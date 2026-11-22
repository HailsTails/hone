import { describe, expect, it } from "vitest";
import { isAbsolutePath } from "./absolute-path.ts";
import { absoluteRootOf } from "./absolute-root-of.ts";

describe("absoluteRootOf", () => {
  it.each(["/repo", "C:\\repo", "c:/repo", "/"] as const)("returns %s unchanged as an absolute path", (text) => {
    expect(absoluteRootOf(text)).toBe(text);
  });

  it("returns text the absolute-path guard accepts", () => {
    expect(isAbsolutePath(absoluteRootOf("/install"))).toBe(true);
  });
});

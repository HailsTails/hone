import { describe, expect, it } from "vitest";

import { isAbsolutePath } from "./absolute-path.ts";

describe("isAbsolutePath", () => {
  it.each(["/x/y", "C:\\x", "C:/x", "\\\\host\\share\\a"])("accepts %j", (text) => {
    expect(isAbsolutePath(text)).toBe(true);
  });

  it.each(["", "x/y", "./x", "x\\y", "C:x"])("refuses %j", (text) => {
    expect(isAbsolutePath(text)).toBe(false);
  });
});

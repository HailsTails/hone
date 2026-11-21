import { describe, expect, it } from "vitest";
import { walkerPieceSettingsSchema } from "./walker-check-schema.ts";

const EXPECTATION = "@ts-expect-" + "error";
const IGNORE = "@ts-" + "ignore";
const NOCHECK = "@ts-" + "nocheck";

describe("walkerPieceSettingsSchema", () => {
  it.each([
    "class-syntax.ts",
    "checks/no-tmp-files.ts",
    "class-syntax.js",
  ])("accepts the module %j, a path inside the piece folder ending .ts, or .js as a built install ships it", (module) => {
    expect(walkerPieceSettingsSchema.safeParse({ module })).toEqual({
      success: true,
      data: { module },
    });
  });

  it.each([
    "../x.ts",
    "../x.js",
    "x.mjs",
    "x",
  ])("refuses the module %j", (module) => {
    expect(walkerPieceSettingsSchema.safeParse({ module }).success).toBe(false);
  });

  it("accepts and keeps the type directives a clause declares as escapes of itself", () => {
    const settings = { module: "cast-expressions.ts", escapingDirectives: [EXPECTATION, IGNORE, NOCHECK] };
    expect(walkerPieceSettingsSchema.safeParse(settings)).toEqual({ success: true, data: settings });
  });

  it("refuses a declared escape the compiler does not honour as one, at that entry", () => {
    expect(
      walkerPieceSettingsSchema.safeParse({ module: "cast-expressions.ts", escapingDirectives: ["@ts-check"] }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["escapingDirectives", 0] }] } });
  });
});

import { describe, expect, it } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { mapResolvedHoneToInstallCheck } from "./hone-install-check.ts";

describe("mapResolvedHoneToInstallCheck", () => {
  it("accepts a sample whose Hone resolves to the same file as its side's install", () => {
    const install = absoluteRootOf("/work/hone-speed-head");

    const check = mapResolvedHoneToInstallCheck({
      sampleResolved: "/work/hone-speed-head/node_modules/.pnpm/hone/package.json",
      installResolved: "/work/hone-speed-head/node_modules/.pnpm/hone/package.json",
      install,
    });

    expect(check).toEqual({ outcome: "ok", value: null });
  });

  it("refuses a sample whose Hone resolves to a different file from its side's install", () => {
    const install = absoluteRootOf("/work/hone-speed-head");

    const check = mapResolvedHoneToInstallCheck({
      sampleResolved: "/work/large-repo/node_modules/@hailstails/hone/package.json",
      installResolved: "/work/hone-speed-head/node_modules/.pnpm/hone/package.json",
      install,
    });

    expect(check).toEqual({
      outcome: "failed",
      error: {
        kind: "hone-outside-install",
        resolved: "/work/large-repo/node_modules/@hailstails/hone/package.json",
        installResolved: "/work/hone-speed-head/node_modules/.pnpm/hone/package.json",
        install: "/work/hone-speed-head",
      },
    });
  });
});

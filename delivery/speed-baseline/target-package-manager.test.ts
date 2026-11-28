import { describe, expect, it } from "vitest";

import { mapFilesToTargetPackageManager } from "./target-package-manager.ts";

describe("mapFilesToTargetPackageManager", () => {
  it("installs with bun when the target locks with bun", () => {
    const files = ["package.json", "bun.lock"];

    const manager = mapFilesToTargetPackageManager({ files });

    expect(manager).toEqual({ outcome: "ok", value: "bun" });
  });

  it("installs with pnpm when the target locks with pnpm", () => {
    const files = ["pnpm-lock.yaml", "package.json"];

    const manager = mapFilesToTargetPackageManager({ files });

    expect(manager).toEqual({ outcome: "ok", value: "pnpm" });
  });

  it("prefers pnpm when the target holds both lockfiles", () => {
    const files = ["bun.lock", "pnpm-lock.yaml"];

    const manager = mapFilesToTargetPackageManager({ files });

    expect(manager).toEqual({ outcome: "ok", value: "pnpm" });
  });

  it("names an npm lockfile it refuses", () => {
    const files = ["package.json", "package-lock.json"];

    const manager = mapFilesToTargetPackageManager({ files });

    expect(manager).toEqual({
      outcome: "failed",
      error: { kind: "lockfile-unsupported", lockfile: "package-lock.json" },
    });
  });

  it("names the lockfile as missing when the target has none", () => {
    const files = ["package.json"];

    const manager = mapFilesToTargetPackageManager({ files });

    expect(manager).toEqual({ outcome: "failed", error: { kind: "lockfile-missing" } });
  });
});

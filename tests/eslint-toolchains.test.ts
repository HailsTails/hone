import { describe, expect, it, vi } from "vitest";
import type { ModuleLoaderPort } from "../src/infrastructure/node/modules/module-loader-port.ts";
import {
  ESLINT_LINES,
  eslintClassOn,
  eslintPeersOn,
  eslintRunnerOn,
  loadedEslintToolchain,
  modulesServingRunner,
  pieceModulesOn,
} from "./eslint-toolchains.ts";

const SERVED_RUNNER = { exceptionPath: "standalone" };

const BASE_MODULE = { outcome: "ok", value: { base: "module" } } as const;

const baseLoader = (): ModuleLoaderPort => ({ load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue(BASE_MODULE) });

describe("the ESLint lines of the development install", () => {
  it("lists the one line of each supported ESLint major, the latest of each", () => {
    expect(ESLINT_LINES).toEqual(["eslint-10", "eslint-9"]);
  });

  it.each([
    { line: "eslint-10", version: "10.15.0" },
    { line: "eslint-9", version: "9.39.5" },
  ] as const)("loads the $line toolchain at ESLint $version", async ({ line, version }) => {
    expect((await loadedEslintToolchain({ line })).eslintVersion).toBe(version);
  });

  it("locates each line's peers from the development install, the way core locates them from its own", () => {
    expect(eslintPeersOn({ line: "eslint-9" }).location.installRoot).toBe(`${import.meta.dirname}/..`);
  });

  it.each([
    { line: "eslint-10", version: "10.15.0" },
    { line: "eslint-9", version: "9.39.5" },
  ] as const)("hands out the ESLint class of $line", async ({ line, version }) => {
    expect((await eslintClassOn({ line })).version).toBe(version);
  });

  it("builds the embedded ESLint runner over a line", () => {
    expect(eslintRunnerOn({ line: "eslint-9" })).toMatchObject({ exceptionPath: "embedded" });
  });
});

describe("modulesServingRunner", () => {
  it("serves the given runner for a path ending in the runner suffix, whatever its separators", async () => {
    const base = baseLoader();
    const modules = modulesServingRunner({ runnerSuffix: "/runner/runner.ts", runner: SERVED_RUNNER, base });
    expect(await modules.load({ path: "C:\\install\\mechanisms\\eslint\\runner\\runner.ts" })).toEqual({
      outcome: "ok",
      value: { runner: SERVED_RUNNER },
    });
    expect(base.load).not.toHaveBeenCalled();
  });

  it("hands any other path to the base loader", async () => {
    const base = baseLoader();
    const modules = modulesServingRunner({ runnerSuffix: "/runner/runner.ts", runner: SERVED_RUNNER, base });
    expect(await modules.load({ path: "/install/mechanisms/eslint/CD-6/cd6/cd6.eslint-plugin.ts" })).toEqual(BASE_MODULE);
  });
});

describe("pieceModulesOn", () => {
  it("builds a piece that wraps native rules from the line's own rules", async () => {
    const base: ModuleLoaderPort = {
      load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
        outcome: "ok",
        value: { createPlugin: vi.fn<(sources: object) => object>().mockReturnValue({ rules: { wrapped: {} } }) },
      }),
    };
    expect(await pieceModulesOn({ line: "eslint-9", base }).load({ path: "/install/piece.ts" })).toEqual({
      outcome: "ok",
      value: { default: { rules: { wrapped: {} } } },
    });
  });

  it("passes a piece without createPlugin through unchanged", async () => {
    expect(await pieceModulesOn({ line: "eslint-9", base: baseLoader() }).load({ path: "/install/piece.ts" })).toEqual(
      BASE_MODULE,
    );
  });
});

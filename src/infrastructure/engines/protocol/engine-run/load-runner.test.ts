import { describe, expect, it, vi } from "vitest";
import type { ModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { mechanismIdSchema } from "../../../hone-config-file/identifiers.ts";
import { loadRunner, type RunnerLocation } from "./load-runner.ts";
import type { LoadedRunner } from "../runner-module/runner-module-schema.ts";

const RUNNER_PATH = "/install/src/infrastructure/engines/audit/runner/runner.ts";

const standaloneRunner = (): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const locationOver = (modules: ModuleLoaderPort): RunnerLocation => ({
  installRoot: absolutePathSchema.parse("/install"),
  moduleExtension: ".ts",
  modules,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  mechanism: mechanismIdSchema.parse("audit"),
});

describe("loadRunner", () => {
  it("loads the runner export from the install's mechanism runner path", async () => {
    const modules = modulesLoading({ runner: standaloneRunner() });
    await expect(loadRunner(locationOver(modules))).resolves.toMatchObject({ outcome: "ok", value: { exceptionPath: "standalone" } });
    expect(modules.load).toHaveBeenCalledExactlyOnceWith({ path: RUNNER_PATH });
  });

  it("is runner-invalid for a runner export whose exception path is outside every path", async () => {
    await expect(
      loadRunner(locationOver(modulesLoading({ runner: { ...standaloneRunner(), exceptionPath: "unknown-path" } }))),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid", mechanism: "audit" } });
  });

  it("is runner-invalid with the loader's detail when the runner module fails to load", async () => {
    const modules: ModuleLoaderPort = {
      load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
        outcome: "failed",
        error: { kind: "module-unloadable", path: RUNNER_PATH, detail: "Cannot find package 'typescript'" },
      }),
    };
    await expect(loadRunner(locationOver(modules))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "audit", detail: "Cannot find package 'typescript'" },
    });
  });

  it("is runner-invalid for a runner module with no runner export", async () => {
    await expect(loadRunner(locationOver(modulesLoading({ createWalkerRunner: vi.fn() })))).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "audit" },
    });
  });
});

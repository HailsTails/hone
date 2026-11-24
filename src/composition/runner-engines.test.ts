import { describe, expect, it, vi } from "vitest";

import type { RunnerModuleOf } from "../application/ports/engine/runner-location.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { runnerEnginesOver } from "./runner-engines.ts";

const LOCATION = {
  installRoot: absoluteRootOf("/install"),
  moduleExtension: ".ts",
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  mechanism: "eslint",
} as const;

const UNLOADABLE = {
  outcome: "failed",
  error: { kind: "module-unloadable", path: "/install/runner.ts", detail: "missing" },
} as const;

describe("runnerEnginesOver", () => {
  it("loads the named runner through the runner module it is given", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue(UNLOADABLE);
    await expect(runnerEnginesOver({ runnerModuleOf }).namedEngine.load(LOCATION)).resolves.toEqual(
      {
        outcome: "failed",
        error: { kind: "runner-invalid", mechanism: "eslint", detail: "missing" },
      },
    );
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(LOCATION);
  });

  it("reads the version 1 projection through the runner module it is given", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue(UNLOADABLE);
    const projection = runnerEnginesOver({ runnerModuleOf }).versionOneProjectionOf({
      installRoot: LOCATION.installRoot,
      modules: LOCATION.modules,
      path: LOCATION.path,
      moduleExtension: ".ts",
      fileText: { read: vi.fn(), exists: vi.fn(), write: vi.fn() },
      fileRemoval: { remove: vi.fn() },
    });
    await expect(
      projection.inspect({
        installRoot: LOCATION.installRoot,
        repoRoot: absoluteRootOf("/repo"),
        trackedPaths: [repoPathOf("src/a.ts")],
        declaredConfigRoots: [],
        clauses: [],
        records: [],
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "missing" },
    });
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(LOCATION);
  });

  it("measures version 1 through the runner module it is given", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue(UNLOADABLE);
    await expect(
      runnerEnginesOver({ runnerModuleOf }).measureVersionOne({
        call: {
          mechanism: "eslint",
          runner: {
            fileScope: "typescript",
            projectedKinds: [],
            run: vi.fn(),
            conform: vi.fn(),
            project: vi.fn(),
          },
          request: {
            repoRoot: absoluteRootOf("/repo"),
            installRoot: LOCATION.installRoot,
            files: [],
            trackedPaths: [],
            answered: [],
            declaredConfigRoots: [],
            declaredConfigLookup: undefined,
            testFiles: { suffixes: ["test"], folders: [] },
            bindings: [],
          },
        },
        location: LOCATION,
        projection: {
          settingsFile: "disciplines.json",
          projectionFile: repoPathOf("disciplines.eslint.mjs"),
          packageFiles: [],
          rules: new Map(),
        },
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "eslint", detail: "missing" },
    });
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(LOCATION);
  });
});

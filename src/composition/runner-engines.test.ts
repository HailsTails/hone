import { describe, expect, it, vi } from "vitest";

import type { RunnerModuleOf } from "../application/ports/engine/runner-location.ts";
import type { FileRemovalPort } from "../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { runnerEnginesOver } from "./runner-engines.ts";

const UNLOADABLE = {
  outcome: "failed",
  error: { kind: "module-unloadable", path: "/install/runner.ts", detail: "missing" },
} as const;

describe("runnerEnginesOver", () => {
  it("loads the named runner through the runner module it is given", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue(UNLOADABLE);
    const location = {
      installRoot: absoluteRootOf("/install"),
      moduleExtension: ".ts",
      modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      mechanism: "eslint",
    } as const;
    await expect(
      runnerEnginesOver({ runnerModuleOf }).namedEngine.load({
        ...location,
        projectionKind: "mjs",
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "eslint", detail: "missing" },
    });
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(location);
  });

  it("reads the version 1 projection through the runner module it is given", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue(UNLOADABLE);
    const modules = { load: vi.fn<ModuleLoaderPort["load"]>() };
    const path = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });
    const projection = runnerEnginesOver({ runnerModuleOf }).versionOneProjectionOf({
      installRoot: absoluteRootOf("/install"),
      modules,
      path,
      moduleExtension: ".ts",
      fileText: {
        read: vi.fn<FileTextPort["read"]>(),
        exists: vi.fn<FileTextPort["exists"]>(),
        write: vi.fn<FileTextPort["write"]>(),
      },
      fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
    });
    await expect(
      projection.inspect({
        installRoot: absoluteRootOf("/install"),
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
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith({
      installRoot: absoluteRootOf("/install"),
      moduleExtension: ".ts",
      modules,
      path,
      mechanism: "eslint",
    });
  });

  it("measures version 1 through the runner module it is given", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue(UNLOADABLE);
    const location = {
      installRoot: absoluteRootOf("/install"),
      moduleExtension: ".ts",
      modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      mechanism: "eslint",
    } as const;
    await expect(
      runnerEnginesOver({ runnerModuleOf }).measureVersionOne({
        request: {
          repoRoot: absoluteRootOf("/repo"),
          installRoot: absoluteRootOf("/install"),
          files: [],
          trackedPaths: [],
          answered: [],
          declaredConfigRoots: [],
          declaredConfigLookup: undefined,
          testFiles: { suffixes: ["test"], folders: [] },
          bindings: [],
        },
        location,
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
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(location);
  });
});

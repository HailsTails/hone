import { describe, expect, it, vi } from "vitest";

import type { RunnerModuleOf } from "../../../../application/ports/engine/runner-location.ts";
import type { ProjectionRequest } from "../../../../application/ports/engine/runner-module.ts";
import type { FileRemovalPort } from "../../../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { versionOneProjectionPortOver } from "./load-version-one-projection.ts";

const INSTALL_ROOT = absoluteRootOf("/install");
const REPOSITORY = absoluteRootOf("/repo");
const PROJECTION = repoPathOf("disciplines.eslint.mjs");
const REQUEST: ProjectionRequest = {
  repoRoot: REPOSITORY,
  installRoot: INSTALL_ROOT,
  clauses: [],
  records: [],
  declaredConfigRoots: [],
  trackedPaths: [],
};

describe("versionOneProjectionPortOver", () => {
  it("loads the ESLint runner module on demand and uses one projection adapter for both operations", async () => {
    const inspect = vi.fn().mockResolvedValue({
      outcome: "ok",
      value: { files: [{ file: PROJECTION, state: "current" }], ruleIds: new Map() },
    });
    const prepare = vi
      .fn()
      .mockResolvedValue({ outcome: "ok", value: [{ path: PROJECTION, effect: "unchanged" }] });
    const factory = vi.fn().mockReturnValue({ inspect, prepare });
    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { versionOneProjectionOver: factory } });
    const modules = { load: vi.fn<ModuleLoaderPort["load"]>() };
    const path = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });
    const fileText = {
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
      exists: vi.fn<FileTextPort["exists"]>(),
    };
    const fileRemoval = { remove: vi.fn<FileRemovalPort["remove"]>() };
    const projectionOf = versionOneProjectionPortOver({ runnerModuleOf });
    const adapter = projectionOf({
      installRoot: INSTALL_ROOT,
      moduleExtension: ".js",
      modules,
      path,
      fileText,
      fileRemoval,
    });
    expect(runnerModuleOf).not.toHaveBeenCalled();
    await expect(adapter.inspect(REQUEST)).resolves.toEqual({
      outcome: "ok",
      value: { files: [{ file: PROJECTION, state: "current" }], ruleIds: new Map() },
    });
    await expect(adapter.prepare(REQUEST)).resolves.toEqual({
      outcome: "ok",
      value: [{ path: PROJECTION, effect: "unchanged" }],
    });
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith({
      installRoot: INSTALL_ROOT,
      moduleExtension: ".js",
      modules,
      path,
      mechanism: "eslint",
    });
    expect(factory).toHaveBeenCalledExactlyOnceWith({
      fileText,
      fileRemoval,
      moduleExtension: ".js",
      path,
    });
    expect(inspect).toHaveBeenCalledExactlyOnceWith(REQUEST);
    expect(prepare).toHaveBeenCalledExactlyOnceWith(REQUEST);
  });

  it("rejects an invalid projection inspection at the engine boundary", async () => {
    const inspect = vi.fn().mockResolvedValue({ outcome: "ok", value: { files: [], ruleIds: [] } });
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue({
      outcome: "ok",
      value: { versionOneProjectionOver: vi.fn().mockReturnValue({ inspect, prepare: vi.fn() }) },
    });
    const projectionOf = versionOneProjectionPortOver({ runnerModuleOf });
    const adapter = projectionOf({
      installRoot: INSTALL_ROOT,
      moduleExtension: ".js",
      modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      fileText: {
        read: vi.fn<FileTextPort["read"]>(),
        write: vi.fn<FileTextPort["write"]>(),
        exists: vi.fn<FileTextPort["exists"]>(),
      },
      fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
    });
    await expect(adapter.inspect(REQUEST)).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("ruleIds") },
    });
  });
});

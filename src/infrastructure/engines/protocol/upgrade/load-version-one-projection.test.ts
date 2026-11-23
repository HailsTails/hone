import { describe, expect, it, vi } from "vitest";

import type { ProjectionRequest } from "../../../../application/ports/engine/runner-module.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import type { VersionOneProjectionPortOf } from "../../../../application/ports/upgrade/version-one-projection-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { loadVersionOneProjectionOver } from "./load-version-one-projection.ts";

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

const optionsOf = (load: ModuleLoaderPort["load"]): Parameters<VersionOneProjectionPortOf>[0] => ({
  installRoot: INSTALL_ROOT,
  moduleExtension: ".js",
  modules: { load },
  path: createDefaultPathPort({}),
  fileText: { read: vi.fn(), write: vi.fn(), exists: vi.fn() },
  fileRemoval: { remove: vi.fn() },
});

describe("loadVersionOneProjectionOver", () => {
  it("loads the installed ESLint module on demand and uses one projection adapter for both operations", async () => {
    const inspect = vi.fn().mockResolvedValue({
      outcome: "ok",
      value: { files: [{ file: PROJECTION, state: "current" }], ruleIds: new Map() },
    });
    const prepare = vi
      .fn()
      .mockResolvedValue({ outcome: "ok", value: [{ path: PROJECTION, effect: "unchanged" }] });
    const factory = vi.fn().mockReturnValue({ inspect, prepare });
    const load = vi
      .fn<ModuleLoaderPort["load"]>()
      .mockResolvedValue({ outcome: "ok", value: { versionOneProjectionOver: factory } });
    const options = optionsOf(load);
    const adapter = loadVersionOneProjectionOver(options);
    expect(load).not.toHaveBeenCalled();
    await expect(adapter.inspect(REQUEST)).resolves.toEqual({
      outcome: "ok",
      value: { files: [{ file: PROJECTION, state: "current" }], ruleIds: new Map() },
    });
    await expect(adapter.prepare(REQUEST)).resolves.toEqual({
      outcome: "ok",
      value: [{ path: PROJECTION, effect: "unchanged" }],
    });
    expect(load).toHaveBeenCalledExactlyOnceWith({
      path: options.path.join({
        segments: [INSTALL_ROOT, "src/infrastructure/engines/eslint/runner/runner.js"],
      }),
    });
    expect(factory).toHaveBeenCalledExactlyOnceWith({
      fileText: options.fileText,
      fileRemoval: options.fileRemoval,
      moduleExtension: options.moduleExtension,
      path: options.path,
    });
    expect(inspect).toHaveBeenCalledExactlyOnceWith(REQUEST);
    expect(prepare).toHaveBeenCalledExactlyOnceWith(REQUEST);
  });

  it("rejects an invalid projection inspection at the engine boundary", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: {
        versionOneProjectionOver: () => ({
          inspect: async () => ({ outcome: "ok", value: { files: [], ruleIds: [] } }),
          prepare: vi.fn(),
        }),
      },
    });
    await expect(loadVersionOneProjectionOver(optionsOf(load)).inspect(REQUEST)).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("ruleIds") },
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import type { FileRemovalPort } from "../../../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { namedChecksRunnerModuleSchema } from "../../protocol/checks/checks-runner-module-schema.ts";
import { versionOneProjectionOver } from "./embedded-runner/create-eslint-runner.ts";
import { eslintRunnerModuleOver } from "./eslint-runner-module.ts";

const PLATFORM = {
  fileText: {
    read: vi.fn<FileTextPort["read"]>(),
    exists: vi.fn<FileTextPort["exists"]>(),
    write: vi.fn<FileTextPort["write"]>(),
  },
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  moduleExtension: ".ts",
} as const;

const UNLOADED = {
  outcome: "failed",
  error: { kind: "runner-invalid-output", detail: "eslint could not be loaded" },
} as const;

describe("eslintRunnerModuleOver", () => {
  it("makes a runner module core accepts, with the version 1 projection operations beside it", () => {
    const runnerModule = eslintRunnerModuleOver({
      toolchain: Promise.resolve(UNLOADED),
      platform: PLATFORM,
    });
    expect(namedChecksRunnerModuleSchema.safeParse(runnerModule.namedChecksRunner)).toMatchObject({
      success: true,
      data: { fileScope: "typescript", projectedKinds: ["config-override", "inline-disable"] },
    });
    expect(runnerModule.versionOneProjectionOver).toBe(versionOneProjectionOver);
  });

  it("measures over the toolchain it is given, failing with that toolchain's load failure", async () => {
    const runnerModule = eslintRunnerModuleOver({
      toolchain: Promise.resolve(UNLOADED),
      platform: PLATFORM,
    });
    await expect(
      runnerModule.measureVersionOne({
        run: {
          repoRoot: absoluteRootOf("/repo"),
          installRoot: absoluteRootOf("/install"),
          files: [repoPathOf("src/a.ts")],
          trackedPaths: [repoPathOf("src/a.ts")],
          answered: [],
          declaredConfigRoots: [],
          declaredConfigLookup: undefined,
          testFiles: { suffixes: ["test"], folders: [] },
          bindings: [],
        },
        projection: {
          settingsFile: "disciplines.json",
          projectionFile: repoPathOf("disciplines.eslint.mjs"),
          packageFiles: [],
          rules: new Map(),
        },
      }),
    ).resolves.toEqual(UNLOADED);
  });
});

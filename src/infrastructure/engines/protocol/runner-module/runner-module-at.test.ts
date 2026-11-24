import { describe, expect, it, vi } from "vitest";

import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { runnerModuleAt } from "./runner-module-at.ts";

describe("runnerModuleAt", () => {
  it("loads the engine's runner module from its place under the install root, and hands back what loaded", async () => {
    const load = vi
      .fn<ModuleLoaderPort["load"]>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: "the runner" } });
    await expect(
      runnerModuleAt({
        installRoot: absoluteRootOf("/install"),
        moduleExtension: ".js",
        modules: { load },
        path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
        mechanism: "eslint",
      }),
    ).resolves.toEqual({ outcome: "ok", value: { namedChecksRunner: "the runner" } });
    expect(load).toHaveBeenCalledExactlyOnceWith({
      path: "/install/src/infrastructure/engines/eslint/runner/runner.js",
    });
  });
});

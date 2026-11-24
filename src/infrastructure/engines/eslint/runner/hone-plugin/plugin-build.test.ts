import { describe, expect, it } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { PluginCheck } from "./check-rule-id.ts";
import { createPluginAt } from "./plugin-build.ts";

const SKIPPED_TESTS_CHECK: PluginCheck = {
  name: "skipped-tests",
  symptom: {
    name: "test-switched-off",
    title: "Test switched off",
    ruleSet: "hone",
  },
  engines: [{ name: "eslint" }],
};

const UNREADABLE_FILE_TEXT: FileTextPort = {
  read: (request) => ({
    outcome: "failed",
    error: { kind: "unreadable", path: request.path, detail: "ENOENT" },
  }),
  exists: () => "absent",
  write: (request) => ({
    outcome: "failed",
    error: { kind: "unwritable", path: request.path, detail: "EROFS" },
  }),
};

const UNLOADABLE_MODULES: ModuleLoaderPort = {
  load: async (request) => ({
    outcome: "failed",
    error: { kind: "module-unloadable", path: request.path, detail: "ENOENT" },
  }),
};

describe("createPluginAt", () => {
  it("fails with the failure text when no piece of the install holds a check rule", async () => {
    const built = await createPluginAt({
      checks: [SKIPPED_TESTS_CHECK],
      installRoot: absoluteRootOf("/install"),
      fileText: UNREADABLE_FILE_TEXT,
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
      modules: UNLOADABLE_MODULES,
    });

    expect(built).toEqual({
      outcome: "failed",
      error:
        "the check hone/test-switched-off#skipped-tests runs on ESLint, but no piece of this install holds its rule",
    });
  });
});

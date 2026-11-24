import { assert, describe, expect, it } from "vitest";

import { mapToolCatalogueToEngineChecks } from "../../src/application/run/engines/tool-engine-checks.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createBoundCatalogueOf } from "../../src/infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import { honePluginAt } from "../../src/infrastructure/engines/eslint/runner/hone-plugin/hone-plugin.ts";
import { installedEslintBoundary } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const REPOSITORY_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", ".."] }),
);

describe("honePluginAt, over this repository's catalogue and pieces", () => {
  it("loads the one plugin, holding a rule under the id of every check the catalogue runs on ESLint and no other", async () => {
    const checks = mapToolCatalogueToEngineChecks({
      boundCatalogueOf: createBoundCatalogueOf({ directory: createDefaultDirectoryPort({}) }),
      fileText,
      path,
      installRoot: REPOSITORY_ROOT,
    });
    assert(checks.outcome === "ok", "this repository's catalogue reads into checks");
    const boundary = await installedEslintBoundary();
    assert(boundary.outcome === "ok", "the installed ESLint has a boundary");

    const plugin = await honePluginAt({
      checks: checks.value,
      installRoot: REPOSITORY_ROOT,
      fileText,
      path,
      modules: createDefaultModuleLoaderPort({}),
      boundary: boundary.value,
    });

    expect(plugin).toEqual({
      outcome: "ok",
      value: {
        meta: { name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" },
        rules: {
          "untyped-value#explicit-any": expect.anything(),
          "untyped-value#implicit-any-let": expect.anything(),
          "claimed-type#non-null-assertions": expect.anything(),
          "name-off-its-casing#naming-convention": expect.anything(),
          "name-off-its-casing#filename-case": expect.anything(),
          "thrown-non-error#throw-only-error": expect.anything(),
          "authored-class-or-this#class-keyword": expect.anything(),
          "authored-class-or-this#static-members-only": expect.anything(),
          "test-switched-off#focused-tests": expect.anything(),
          "test-switched-off#skipped-tests": expect.anything(),
          "positional-parameters#parameter-count": expect.anything(),
          "tangled-function#cognitive-complexity": expect.anything(),
          "long-function#function-length": expect.anything(),
          "wide-input#unread-parameter": expect.anything(),
          "work-inside-a-condition#else-after-an-exit": expect.anything(),
          "rebinding#parameter-reassignment": expect.anything(),
        },
      },
    });
  });
});

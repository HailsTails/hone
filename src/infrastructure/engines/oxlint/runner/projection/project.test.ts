import { describe, expect, it } from "vitest";

import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { DEFAULT_TEST_FILES } from "../../../../../domain/settings/test-files.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createProjectionPlan } from "./project.ts";

describe("createProjectionPlan", () => {
  it("writes only for configured roots when the repo has a package config and a former projection", () => {
    const packageFile = repoPathOf("packages/app/index.ts");

    const planned = createProjectionPlan({
      repoRoot: absoluteRootOf("/repo"),
      installRoot: absolutePathSchema.parse("/install"),
      trackedPaths: [
        repoPathOf("packages/app/.oxlintrc.json"),
        repoPathOf("packages/former/hone.oxlint.json"),
        packageFile,
      ],
      files: [packageFile],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      testFiles: DEFAULT_TEST_FILES,
      bindings: [],
    });

    expect(planned).toMatchObject({
      outcome: "ok",
      value: {
        entries: [{ kind: "write", file: "packages/app/hone.oxlint.json" }],
        scopes: [
          { file: "packages/app/hone.oxlint.json", config: "packages/app/.oxlintrc.json" },
          { file: "packages/former/hone.oxlint.json", config: undefined, files: [] },
        ],
      },
    });
  });
});

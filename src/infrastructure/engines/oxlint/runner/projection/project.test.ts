import { describe, expect, it } from "vitest";

import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { DEFAULT_TEST_FILES } from "../../../../../domain/settings/test-files.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createProjectionPlan } from "./project.ts";

describe("createProjectionPlan", () => {
  it("writes a projection for each config and leaves a former package projection alone", () => {
    const rootFile = repoPathOf("index.ts");
    const packageFile = repoPathOf("packages/app/index.ts");

    const planned = createProjectionPlan({
      repoRoot: absoluteRootOf("/repo"),
      installRoot: absolutePathSchema.parse("/install"),
      trackedPaths: [
        repoPathOf(".oxlintrc.json"),
        repoPathOf("packages/app/.oxlintrc.json"),
        repoPathOf("packages/former/hone.oxlint.json"),
        rootFile,
        packageFile,
      ],
      files: [rootFile, packageFile],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      testFiles: DEFAULT_TEST_FILES,
      bindings: [],
    });

    expect(planned).toMatchObject({
      outcome: "ok",
      value: {
        entries: [
          { kind: "write", file: "hone.oxlint.json" },
          { kind: "write", file: "packages/app/hone.oxlint.json" },
        ],
      },
    });
  });
});

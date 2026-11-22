import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import {
  configuredDirectoriesOf,
  outsideNestedRepositories,
  packageConfigFilesOf,
} from "./checks-config-roots.ts";

const TRACKED = [
  repoPathOf("eslint.config.mjs"),
  repoPathOf("package.json"),
  repoPathOf("packages/a/eslint.config.js"),
  repoPathOf("packages/a/eslint.config.mjs"),
  repoPathOf("packages/a/src/a.ts"),
  repoPathOf("packages/b/tools/eslint.config.ts"),
];

describe("configuredDirectoriesOf", () => {
  it("names every directory holding an ESLint config, the repository root as an empty name, when each file looks up its nearest config", () => {
    expect(configuredDirectoriesOf({ trackedPaths: TRACKED, lookup: "nearest-to-file" })).toEqual([
      "",
      "packages/a",
      "packages/a",
      "packages/b/tools",
    ]);
  });

  it("names none when only the repository root's config is looked up", () => {
    expect(configuredDirectoriesOf({ trackedPaths: TRACKED, lookup: "repository-root" })).toEqual(
      [],
    );
  });
});

describe("packageConfigFilesOf", () => {
  it("names each ESLint config below the repository root, and not the one at the root", () => {
    expect(
      packageConfigFilesOf({
        trackedPaths: TRACKED,
        lookup: "nearest-to-file",
        nestedRepositories: [],
      }),
    ).toEqual([
      "packages/a/eslint.config.js",
      "packages/a/eslint.config.mjs",
      "packages/b/tools/eslint.config.ts",
    ]);
  });

  it("names none for a root-only lookup", () => {
    expect(
      packageConfigFilesOf({
        trackedPaths: TRACKED,
        lookup: "repository-root",
        nestedRepositories: [],
      }),
    ).toEqual([]);
  });

  it("leaves out an ESLint config inside a nested repository, which belongs to that repository", () => {
    expect(
      packageConfigFilesOf({
        trackedPaths: TRACKED,
        lookup: "nearest-to-file",
        nestedRepositories: ["packages/a"],
      }),
    ).toEqual(["packages/b/tools/eslint.config.ts"]);
  });
});

describe("outsideNestedRepositories", () => {
  it("keeps the folders outside every nested repository, and not the nested repository itself, a folder inside it, or one that only shares its prefix", () => {
    expect(
      outsideNestedRepositories({
        directories: ["vendor/lib", "vendor/lib/tools", "vendor/library", "packages/a"],
        nestedRepositories: ["vendor/lib"],
      }),
    ).toEqual(["vendor/library", "packages/a"]);
  });
});

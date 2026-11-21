import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { answeredWithin, slicesOf } from "./checks-slices.ts";

const TRACKED = [
  repoPathSchema.parse("eslint.config.mjs"),
  repoPathSchema.parse("packages/b/tools/eslint.config.ts"),
  repoPathSchema.parse("packages/a/eslint.config.js"),
  repoPathSchema.parse("packages/a/src/a.ts"),
];

const ROOT_SLICE = { directory: undefined, file: repoPathSchema.parse("hone.eslint.mjs") };

const PACKAGE_A_SLICE = { directory: repoPathSchema.parse("packages/a"), file: repoPathSchema.parse("packages/a/hone.eslint.mjs") };

const PACKAGE_B_TOOLS_SLICE = { directory: repoPathSchema.parse("packages/b/tools"), file: repoPathSchema.parse("packages/b/tools/hone.eslint.mjs") };

const PACKAGE_C_SLICE = { directory: repoPathSchema.parse("packages/c"), file: repoPathSchema.parse("packages/c/hone.eslint.mjs") };

describe("slicesOf", () => {
  it("names the root slice and one slice per package config, in code unit order, when each file looks up its nearest config", () => {
    expect(slicesOf({ trackedPaths: TRACKED, declared: [], lookup: "nearest-to-file", nestedRepositories: [] })).toEqual({
      root: ROOT_SLICE,
      packages: [PACKAGE_A_SLICE, PACKAGE_B_TOOLS_SLICE],
    });
  });

  it("names only the root slice when only the repository root's config is looked up", () => {
    expect(slicesOf({ trackedPaths: TRACKED, declared: [], lookup: "repository-root", nestedRepositories: [] })).toEqual({ root: ROOT_SLICE, packages: [] });
  });

  it("names no slice for a config inside a nested repository, which belongs to that repository", () => {
    expect(slicesOf({ trackedPaths: TRACKED, declared: [], lookup: "nearest-to-file", nestedRepositories: ["packages/a"] })).toEqual({
      root: ROOT_SLICE,
      packages: [PACKAGE_B_TOOLS_SLICE],
    });
  });

  it("names a declared folder once when it is also configured, and adds one that is only declared", () => {
    expect(
      slicesOf({
        trackedPaths: TRACKED,
        declared: [repoPathSchema.parse("packages/c"), repoPathSchema.parse("packages/a")],
        lookup: "nearest-to-file",
        nestedRepositories: [],
      }),
    ).toEqual({ root: ROOT_SLICE, packages: [PACKAGE_A_SLICE, PACKAGE_B_TOOLS_SLICE, PACKAGE_C_SLICE] });
  });
});

describe("slicesOf, declared folders and nested repositories", () => {
  it("names no slice for a declared folder that is a nested repository or inside one", () => {
    expect(
      slicesOf({
        trackedPaths: [],
        declared: [repoPathSchema.parse("vendor/lib"), repoPathSchema.parse("vendor/lib/tools"), repoPathSchema.parse("packages/c")],
        lookup: "repository-root",
        nestedRepositories: ["vendor/lib"],
      }),
    ).toEqual({ root: ROOT_SLICE, packages: [PACKAGE_C_SLICE] });
  });
});

const ANSWERED = [
  { symptom: "authored-class-or-this", check: "class-keyword", file: repoPathSchema.parse("packages/a/src/a.ts") },
  { symptom: "authored-class-or-this", file: repoPathSchema.parse("packages/ab/src/a.ts") },
  { symptom: "authored-class-or-this", file: repoPathSchema.parse("kept.ts") },
];

describe("answeredWithin", () => {
  it("keeps every answer for the root slice, with its repository paths", () => {
    expect(answeredWithin({ answered: ANSWERED, slice: ROOT_SLICE })).toEqual(ANSWERED);
  });

  it("keeps only the answers under a package folder, relative to that folder, and not those of a folder sharing its prefix", () => {
    expect(answeredWithin({ answered: ANSWERED, slice: PACKAGE_A_SLICE })).toEqual([{ symptom: "authored-class-or-this", check: "class-keyword", file: "src/a.ts" }]);
  });
});

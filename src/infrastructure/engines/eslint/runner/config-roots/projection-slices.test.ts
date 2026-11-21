import { describe, expect, it } from "vitest";
import { VERSION_ONE_CAUSAL_WHY_CHAIN } from "../../../../../../tests/version-one-causal-why-chain.ts";
import type { ExceptionRecord } from "../../../../discipline-exceptions-folder/exception-records.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import {
  type ConfigRoot,
  configRootsOf,
  governingPackageOf,
  orphanedSliceDirectoriesOf,
  packageFoldersOf,
  nestedConfigurationFoldersOf,
  sliceRecordsOf,
  slicePathOf,
  unprojectedFoldersOf,
} from "./projection-slices.ts";

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");
const eslint = mechanismIdSchema.parse("eslint");

const tracked = (paths: readonly string[]) => repoPathSchema.array().parse(paths);

const REPOSITORY: ConfigRoot = { placement: "repository" };
const PACKAGE_A: ConfigRoot = { placement: "package", directory: repoPathSchema.parse("packages/a") };
const PACKAGE_B: ConfigRoot = { placement: "package", directory: repoPathSchema.parse("packages/b") };
const NESTED_IN_A: ConfigRoot = { placement: "package", directory: repoPathSchema.parse("packages/a/tools") };

const carveOutIn = (file: string): ExceptionRecord => ({
  kind: "file-carve-out",
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse(file),
  reason: "Inherited class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
});

const clauseWide: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: classSyntax,
  mechanism: eslint,
  reason: "Class syntax carved out during migration",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

describe("configRootsOf", () => {
  it("is only the repository root when no package carries its own eslint.config", () => {
    expect(
      configRootsOf({ trackedPaths: tracked(["eslint.config.mjs", "src/a.ts", "package.json"]), declared: [], lookup: "nearest-to-file" }),
    ).toEqual([REPOSITORY]);
  });

  it("adds each folder holding a tracked eslint.config file of any name ESLint looks up, in code-unit order", () => {
    expect(
      configRootsOf({
        trackedPaths: tracked([
          "packages/b/eslint.config.ts",
          "packages/a/eslint.config.mjs",
          "packages/a/tools/eslint.config.cjs",
          "packages/c/eslint.config.json",
        ]),
        declared: [],
        lookup: "nearest-to-file",
      }),
    ).toEqual([REPOSITORY, PACKAGE_A, NESTED_IN_A, PACKAGE_B]);
  });

  it("adds a declared folder whose eslint.config a wrapper generates and git does not track, once", () => {
    expect(
      configRootsOf({
        trackedPaths: tracked(["packages/a/eslint.config.mjs", "packages/b/sku.config.ts"]),
        declared: tracked(["packages/b", "packages/a"]),
        lookup: "nearest-to-file",
      }),
    ).toEqual([REPOSITORY, PACKAGE_A, PACKAGE_B]);
  });

  it("leaves out a folder inside another repository that has its own disciplines.json", () => {
    expect(
      configRootsOf({
        trackedPaths: tracked([
          "fixtures/consumer/disciplines.json",
          "fixtures/consumer/eslint.config.mjs",
          "fixtures/consumer/packages/a/eslint.config.mjs",
          "packages/a/eslint.config.mjs",
        ]),
        declared: tracked(["fixtures/consumer/packages/b"]),
        lookup: "nearest-to-file",
      }),
    ).toEqual([REPOSITORY, PACKAGE_A]);
  });

  it("counts only declared folders when ESLint resolves every file from the repository root's config", () => {
    expect(
      configRootsOf({
        trackedPaths: tracked(["packages/a/eslint.config.mjs", "packages/b/sku.config.ts"]),
        declared: tracked(["packages/b"]),
        lookup: "repository-root",
      }),
    ).toEqual([REPOSITORY, PACKAGE_B]);
  });
});

describe("slicePathOf", () => {
  it("keeps the repository root's projection at disciplines.eslint.mjs", () => {
    expect(slicePathOf({ root: REPOSITORY })).toBe("disciplines.eslint.mjs");
  });

  it("writes a package's slice beside its eslint.config", () => {
    expect(slicePathOf({ root: PACKAGE_A })).toBe("packages/a/disciplines.eslint.mjs");
  });
});

describe("sliceRecordsOf", () => {
  it("gives the repository root every record unchanged", () => {
    expect(
      sliceRecordsOf({ root: REPOSITORY, records: [carveOutIn("packages/a/src/old.ts"), carveOutIn("src/old.ts"), clauseWide] }),
    ).toEqual([carveOutIn("packages/a/src/old.ts"), carveOutIn("src/old.ts"), clauseWide]);
  });

  it("gives a package only the file records under it, with paths relative to the package, and every clause-wide record", () => {
    expect(
      sliceRecordsOf({
        root: PACKAGE_A,
        records: [
          carveOutIn("packages/a/src/old.ts"),
          carveOutIn("packages/ab/src/old.ts"),
          carveOutIn("src/old.ts"),
          carveOutIn("packages/a/route/[id].ts"),
          clauseWide,
        ],
      }),
    ).toEqual([carveOutIn("src/old.ts"), carveOutIn("route/[id].ts"), clauseWide]);
  });

  it("keeps a record under a nested package in the enclosing package's slice too", () => {
    expect(sliceRecordsOf({ root: PACKAGE_A, records: [carveOutIn("packages/a/tools/old.ts")] })).toEqual([
      carveOutIn("tools/old.ts"),
    ]);
  });
});

describe("packageFoldersOf", () => {
  it("is the folder of every package root, leaving out the repository root", () => {
    expect([...packageFoldersOf({ roots: [REPOSITORY, PACKAGE_A, NESTED_IN_A] })]).toEqual(["packages/a", "packages/a/tools"]);
  });
});

describe("governingPackageOf", () => {
  const packages = packageFoldersOf({ roots: [REPOSITORY, PACKAGE_A, NESTED_IN_A, PACKAGE_B] });

  it("is the deepest package folder holding the file", () => {
    expect(governingPackageOf({ file: repoPathSchema.parse("packages/a/tools/run.ts"), packages })).toBe("packages/a/tools");
  });

  it("is the package folder for a file directly under it", () => {
    expect(governingPackageOf({ file: repoPathSchema.parse("packages/a/x.ts"), packages })).toBe("packages/a");
  });

  it("is no package for a file outside every package, even one whose folder starts like a package", () => {
    expect(governingPackageOf({ file: repoPathSchema.parse("packages/ab/x.ts"), packages })).toBeUndefined();
  });

  it("is no package for a file at the repository root", () => {
    expect(governingPackageOf({ file: repoPathSchema.parse("x.ts"), packages })).toBeUndefined();
  });
});

describe("nestedConfigurationFoldersOf", () => {
  const NESTED_TREE = tracked([
    "fixtures/consumer/disciplines.json",
    "fixtures/consumer/inner/disciplines.json",
    "fixtures/plain/disciplines.json",
    "fixtures/idle/disciplines.json",
  ]);

  it("names each outermost folder holding its own disciplines.json and a file under check", () => {
    expect(
      nestedConfigurationFoldersOf({
        trackedPaths: NESTED_TREE,
        files: tracked(["fixtures/consumer/inner/old.ts", "fixtures/plain/x.ts", "src/a.ts"]),
      }),
    ).toEqual(["fixtures/consumer", "fixtures/plain"]);
  });
});

describe("unprojectedFoldersOf", () => {
  const OWN_CONFIG_TREE = tracked([
    "eslint.config.mjs",
    "fixtures/linted/disciplines.json",
    "fixtures/linted/eslint.config.mjs",
    "fixtures/linted/inner/eslint.config.mjs",
    "fixtures/rooted/disciplines.json",
    "fixtures/deep/disciplines.json",
    "fixtures/deep/tool/eslint.config.mjs",
    "fixtures/idle/disciplines.json",
    "fixtures/idle/eslint.config.mjs",
    "packages/a/eslint.config.mjs",
  ]);

  const FILES = tracked([
    "fixtures/linted/inner/a.ts",
    "fixtures/rooted/src/parse.ts",
    "fixtures/deep/tool/b.ts",
    "fixtures/deep/c.ts",
    "packages/a/d.ts",
    "src/e.ts",
  ]);

  it("names each outermost folder inside a folder holding its own disciplines.json whose own ESLint config its files load, holding a file under check, beside the folder holding that disciplines.json", () => {
    expect(unprojectedFoldersOf({ trackedPaths: OWN_CONFIG_TREE, files: FILES, lookup: "nearest-to-file" })).toEqual([
      { folder: "fixtures/deep/tool", selectionFolder: "fixtures/deep" },
      { folder: "fixtures/linted", selectionFolder: "fixtures/linted" },
    ]);
  });

  it("names the outermost folder holding its own disciplines.json as the one a person would govern from this repository", () => {
    expect(
      unprojectedFoldersOf({
        trackedPaths: tracked(["eslint.config.mjs", "nested/disciplines.json", "nested/inner/disciplines.json", "nested/inner/src/eslint.config.mjs"]),
        files: tracked(["nested/inner/src/n.ts"]),
        lookup: "nearest-to-file",
      }),
    ).toEqual([{ folder: "nested/inner/src", selectionFolder: "nested" }]);
  });

  it("names no folder holding its own disciplines.json but no ESLint config, whose files load the config above it", () => {
    expect(
      unprojectedFoldersOf({
        trackedPaths: tracked(["eslint.config.mjs", "fixtures/rooted/disciplines.json"]),
        files: tracked(["fixtures/rooted/src/parse.ts"]),
        lookup: "nearest-to-file",
      }),
    ).toEqual([]);
  });

  it("names no folder when every file loads the repository root's config", () => {
    expect(unprojectedFoldersOf({ trackedPaths: OWN_CONFIG_TREE, files: FILES, lookup: "repository-root" })).toEqual([]);
  });
});

describe("orphanedSliceDirectoriesOf", () => {
  it("names each tracked slice outside every config root and outside nested repositories", () => {
    expect(
      orphanedSliceDirectoriesOf({
        trackedPaths: tracked([
          "disciplines.eslint.mjs",
          "packages/a/disciplines.eslint.mjs",
          "packages/old/disciplines.eslint.mjs",
          "fixtures/consumer/disciplines.json",
          "fixtures/consumer/disciplines.eslint.mjs",
        ]),
        roots: [REPOSITORY, PACKAGE_A],
      }),
    ).toEqual(["packages/old"]);
  });
});

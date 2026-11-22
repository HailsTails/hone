import { describe, expect, it } from "vitest";

import type { LockedPackage } from "../published-manifest/pnpm-lock.ts";
import {
  bundledPackageCodeOf,
  deadLinksOf,
  misplacedEntriesOf,
  undeclaredImportsOf,
  unlockedRangesOf,
  versionMentionsOf,
} from "./package-guards.ts";

const output = (request: {
  readonly path: string;
  readonly entryPoint?: string;
  readonly inputs?: readonly string[];
  readonly externalImports?: readonly string[];
}) => ({
  path: request.path,
  text: "",
  entryPoint: request.entryPoint,
  inputs: request.inputs ?? [],
  externalImports: request.externalImports ?? [],
});

describe("undeclaredImportsOf", () => {
  it("accepts imports of node: builtins, of each declared peer and dependency and of each one's subpaths", () => {
    expect(
      undeclaredImportsOf({
        outputs: [
          output({
            path: "chunks/chunk-A.js",
            externalImports: [
              "node:fs",
              "eslint",
              "eslint/use-at-your-own-risk",
              "typescript",
              "zod",
              "zod/v4",
              "@eslint/plugin-kit",
            ],
          }),
        ],
        declared: ["eslint", "typescript", "zod", "@eslint/plugin-kit"],
      }),
    ).toEqual([]);
  });

  it("names each output that imports a package declared neither as a peer nor as a dependency, and a bare builtin", () => {
    expect(
      undeclaredImportsOf({
        outputs: [
          output({ path: "chunks/chunk-A.js", externalImports: ["levn", "eslint", "zod"] }),
          output({ path: "src/hone.js", externalImports: ["fs", "zod-extra", "eslint-plugin-x"] }),
        ],
        declared: ["eslint", "zod"],
      }),
    ).toEqual([
      "chunks/chunk-A.js imports levn",
      "src/hone.js imports fs",
      "src/hone.js imports zod-extra",
      "src/hone.js imports eslint-plugin-x",
    ]);
  });
});

describe("misplacedEntriesOf", () => {
  it("accepts entries emitted at their own path holding their own code", () => {
    expect(
      misplacedEntriesOf({
        entryPoints: ["mechanisms/eslint/runner/runner.ts"],
        outputs: [
          output({
            path: "mechanisms/eslint/runner/runner.js",
            entryPoint: "mechanisms/eslint/runner/runner.ts",
            inputs: ["mechanisms/eslint/runner/runner.ts"],
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("names an entry whose code another entry pulled into a shared chunk, and an entry with no output at its path", () => {
    expect(
      misplacedEntriesOf({
        entryPoints: ["mechanisms/eslint/runner/runner.ts", "src/hone.ts"],
        outputs: [
          output({
            path: "mechanisms/eslint/runner/runner.js",
            entryPoint: "mechanisms/eslint/runner/runner.ts",
            inputs: [],
          }),
          output({ path: "chunks/chunk-A.js", inputs: ["mechanisms/eslint/runner/runner.ts"] }),
        ],
      }),
    ).toEqual([
      "mechanisms/eslint/runner/runner.ts is not emitted with its own code at mechanisms/eslint/runner/runner.js",
      "src/hone.ts is not emitted with its own code at src/hone.js",
    ]);
  });
});

const LOCKED: readonly LockedPackage[] = [
  { name: "zod", version: "4.4.3" },
  { name: "@eslint/plugin-kit", version: "0.7.3" },
];

describe("unlockedRangesOf", () => {
  it("accepts dependencies published as caret ranges whose floor is the version the lock holds", () => {
    expect(
      unlockedRangesOf({
        ranges: { zod: "^4.4.3", "@eslint/plugin-kit": "^0.7.3" },
        locked: LOCKED,
      }),
    ).toEqual([]);
  });

  it("names a dependency whose caret range starts below or above the version the lock holds", () => {
    expect(
      unlockedRangesOf({
        ranges: { zod: "^4.4.2", "@eslint/plugin-kit": "^0.7.4" },
        locked: LOCKED,
      }),
    ).toEqual([
      "zod is published as ^4.4.2, whose floor is not the locked 4.4.3",
      "@eslint/plugin-kit is published as ^0.7.4, whose floor is not the locked 0.7.3",
    ]);
  });

  it("names a dependency published as an exact version or as anything wider than a caret range", () => {
    expect(
      unlockedRangesOf({
        ranges: { zod: "4.4.3", "@eslint/plugin-kit": ">=0.7.3" },
        locked: LOCKED,
      }),
    ).toEqual([
      "zod is published as 4.4.3, which is not a caret range of one release",
      "@eslint/plugin-kit is published as >=0.7.3, which is not a caret range of one release",
    ]);
  });

  it("names a dependency the lock's root importer holds no version of", () => {
    expect(unlockedRangesOf({ ranges: { levn: "^0.4.1" }, locked: LOCKED })).toEqual([
      "levn is published as ^0.4.1, but the lock's root importer holds no version of it",
    ]);
  });
});

describe("bundledPackageCodeOf", () => {
  it("accepts a bundle that carries no installed package's code", () => {
    expect(bundledPackageCodeOf({ packageRoots: [] })).toEqual([]);
  });

  it("names each installed package whose code the bundle carries", () => {
    expect(
      bundledPackageCodeOf({ packageRoots: ["node_modules/zod", "../../node_modules/levn"] }),
    ).toEqual([
      "node_modules/zod is bundled into the package",
      "../../node_modules/levn is bundled into the package",
    ]);
  });
});

describe("deadLinksOf", () => {
  it("accepts links to shipped files and folders, anchors, and absolute URLs", () => {
    expect(
      deadLinksOf({
        files: [
          {
            path: "README.md",
            text: "[a](ADOPTING.md#2-install) [b](methods/) [c](https://example.com) [d](#runtime)",
          },
          { path: "ADOPTING.md", text: "[back](README.md)" },
          { path: "methods/README.md", text: "" },
          { path: "rules/CD-1/README.md", text: "[up](../../ADOPTING.md#9-apply)" },
        ],
      }),
    ).toEqual([]);
  });

  it("names each page link to a file the package does not ship", () => {
    expect(
      deadLinksOf({
        files: [
          { path: "README.md", text: "[a](tests/test-fixtures/walkthrough/) [b](MIGRATING.md)" },
          { path: "rules/CD-1/README.md", text: "[piece](../../mechanisms/eslint/CD-1/README.md)" },
          { path: "src/hone.js", text: "[not](a-link.md)" },
        ],
      }),
    ).toEqual([
      "README.md links to tests/test-fixtures/walkthrough",
      "README.md links to MIGRATING.md",
      "rules/CD-1/README.md links to mechanisms/eslint/CD-1/README.md",
    ]);
  });
});

describe("versionMentionsOf", () => {
  it("accepts pages naming a placeholder tarball, older versions in prose, toolchain versions and other packages' tarballs", () => {
    expect(
      versionMentionsOf({
        files: [
          {
            path: "README.md",
            text: "Download `hailstails-hone-<version>.tgz`; TypeScript 4.8.4 or later.",
          },
          {
            path: "MIGRATING.md",
            text: "Version `0.1.0-pre.1` shipped as `honed-0.1.0-pre.1.tgz`.",
          },
          {
            path: "ADOPTING.md",
            text: "Not `other-core-0.1.0-pre.3.tgz`, and not 0.1.0-pre.30 or 10.1.0-pre.3.",
          },
          { path: "rules/CD-1/discipline.json", text: "hailstails-hone-0.0.0.tgz 0.1.0-pre.3" },
        ],
        tarballStem: "hailstails-hone",
        version: "0.1.0-pre.3",
      }),
    ).toEqual([]);
  });

  it("names each versioned tarball of the package a shipped page names, at any version", () => {
    expect(
      versionMentionsOf({
        files: [
          { path: "README.md", text: "wrote artefacts/hailstails-hone-0.0.0.tgz" },
          { path: "ADOPTING.md", text: "vendor/hailstails-hone/hailstails-hone-0.1.0-pre.3.tgz" },
        ],
        tarballStem: "hailstails-hone",
        version: "0.1.0-pre.3",
      }),
    ).toEqual([
      "README.md names hailstails-hone-0.0.0.tgz",
      "ADOPTING.md names hailstails-hone-0.1.0-pre.3.tgz",
    ]);
  });

  it("names each shipped page that names the package's current version, with or without a v", () => {
    expect(
      versionMentionsOf({
        files: [
          { path: "README.md", text: "The current version, `0.1.0`, is stable; so is 0.1.0." },
          {
            path: "ADOPTING.md",
            text: "See the [`v0.1.0` release](https://github.com/example/tool/releases/tag/v0.1.0).",
          },
          { path: "docs/notes.md", text: "Not 0.1.0-pre.3, 0.1.0.1 or 10.1.0." },
        ],
        tarballStem: "hailstails-hone",
        version: "0.1.0",
      }),
    ).toEqual([
      "README.md names 0.1.0",
      "README.md names 0.1.0",
      "ADOPTING.md names v0.1.0",
      "ADOPTING.md names v0.1.0",
    ]);
  });
});

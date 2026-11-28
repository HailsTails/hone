import { assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { installedEslintBoundary } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { findImportsOutside, listBoundaryFiles } from "./import-confinement.ts";
import { createModuleImportsReader } from "./module-imports.ts";
import { readRepositoryImports } from "./source-imports.ts";
import { VENDOR_BOUNDARIES } from "./vendor-boundaries.ts";

const KNOWN_FILES = [
  {
    boundary: "core",
    files: expect.arrayContaining(["src/application/run/version-two-run.ts"]),
  },
  {
    boundary: "outside mechanisms",
    files: expect.arrayContaining([
      "src/application/run/version-two-run.ts",
      "delivery/install-proof/install-proof.ts",
      "delivery/install-proof/run-install-proof.ts",
    ]),
  },
  {
    boundary: "Oxlint naming plugin",
    files: [
      "src/infrastructure/engines/oxlint/name-off-its-casing/naming-convention/naming-plugin.ts",
    ],
  },
  { boundary: "unlisted mechanisms", files: [] },
  {
    boundary: "runners",
    files: expect.arrayContaining([
      "src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts",
    ]),
  },
  {
    boundary: "platform ports",
    files: expect.arrayContaining([
      "src/infrastructure/node/file-system/file-text-port.ts",
      "src/infrastructure/node/file-system/file-system-port.ts",
      "src/infrastructure/node/process/execution-port.ts",
    ]),
  },
  {
    boundary: "module loader port",
    files: ["src/infrastructure/node/modules/module-loader-port.ts"],
  },
  { boundary: "install proof ports", files: ["delivery/install-proof/install-proof-ports.ts"] },
  { boundary: "bundler port", files: ["delivery/packaging/building/esbuild-bundler-port.ts"] },
  {
    boundary: "typescript parse",
    files: ["src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts"],
  },
  {
    boundary: "jsonc parse",
    files: ["src/infrastructure/engines/walker/runner/pieces/jsonc-parse.ts"],
  },
  {
    boundary: "ESLint toolchain",
    files: ["src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts"],
  },
  {
    boundary: "ESLint instance",
    files: ["src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts"],
  },
  {
    boundary: "inline config parser",
    files: ["src/infrastructure/engines/eslint/runner/native-exceptions/inline-config-parser.ts"],
  },
  {
    boundary: "native rules",
    files: ["src/infrastructure/engines/eslint/runner/pieces/native-rules.ts"],
  },
  {
    boundary: "audit pieces",
    files: expect.arrayContaining([
      "src/infrastructure/engines/walker/authored-class-or-this/class-keyword/class-syntax.ts",
      "src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts",
    ]),
  },
  {
    boundary: "ESLint pieces",
    files: expect.arrayContaining([
      "src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts",
    ]),
  },
  {
    boundary: "tests",
    files: expect.arrayContaining([
      "src/application/upgrade/record-answers/measurement.test.ts",
      "src/infrastructure/node/file-system/file-system-port.test.ts",
      "src/infrastructure/node/process/execution-port.test.ts",
      "src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.test.ts",
    ]),
  },
];

describe("what this repository's source files import", () => {
  it("is read from the known files of each vendor boundary, and no mechanism sits outside a runner or piece folder", async () => {
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", ".."] }),
    );
    const sources = await readRepositoryImports({ repoRoot });
    assert(sources.outcome === "ok", "the repository's source files read");

    const files = listBoundaryFiles({ sources: sources.value, boundaries: VENDOR_BOUNDARIES });

    expect(files).toEqual(KNOWN_FILES);
  });

  it("stays within every vendor boundary", async () => {
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", ".."] }),
    );
    const sources = await readRepositoryImports({ repoRoot });
    assert(sources.outcome === "ok", "the repository's source files read");

    const outside = findImportsOutside({
      sources: sources.value,
      boundaries: VENDOR_BOUNDARIES,
      path,
    });

    expect(outside).toEqual([]);
  });
});

describe("the declaration hone project writes", () => {
  it("imports nothing", async () => {
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", ".."] }),
    );
    const parse = await loadParsePort({
      peers: defaultTypeScriptPeers({ installRoot: repoRoot, installForm: "source" }),
    });
    assert(parse.outcome === "ok", "the typescript line loads from the development install");
    const installed = await installedEslintBoundary();
    assert(installed.outcome === "ok", "the installed ESLint has a boundary");
    const readModuleImports = createModuleImportsReader({ parse: parse.value });

    const imports = readModuleImports({
      file: "hone.eslint.d.mts",
      text: installed.value.declarationText,
    });

    expect(imports).toEqual([]);
  });
});

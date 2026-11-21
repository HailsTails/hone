import { describe, expect, it } from "vitest";
import {
  computedModuleLoad,
  dynamicLoadMatching,
  importsOutside,
  importsOutsideFromOwnFolder,
  nodeBuiltinImport,
  packageImport,
  packageDynamicImport,
  packageOrComputedImport,
  packageTypeImport,
  relativeImport,
  relativeImportOfAnyForm,
  relativeImportReaching,
} from "../../../../../tests/confinement.ts";
import { INSTALLED_DECLARATION_TEXT } from "../../../../../tests/installed-declaration-text.ts";
import { projectionDeclarationKeyIn, ROOT_PROJECTION_DECLARATION_KEY, withoutProjectionOutputs } from "../../../../../tests/without-projection-outputs.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const loadedOutsideMechanisms = import.meta.glob(
  [
    "./**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./node_modules/**",
    "!./dist/**",
    "!./artefacts/**",
    "!./*.test.*",
    "!./src/**/*.test.*",
    "!./rules/**/*.test.*",
    "!./tests/**/*.test.*",
    "!./delivery/**/*.test.*",
    "!./delivery/install-proof/consumer-proof/**",
    "!./src/application/run/check/cd1-cascade/**",
    "!./src/application/run/check/cd1-exempted/**",
    "!./src/infrastructure/command-line/documentation/walkthrough/**",
    "!./src/operations/prune-debt/prune-debt/**",
    "!./tests/required-entry.ts",
    "!./tests/confinement.ts",
    "!./tests/conformance-rows.ts",
    "!./tests/eslint-toolchains.ts",
    "!./tests/typescript-parse-port.ts",
    "!./src/infrastructure/engines/audit/**",
    "!./src/infrastructure/engines/eslint/*/**",
    "!./vitest.config.ts",
    "!./delivery/install-proof/install-proof-ports.ts",
    "!./delivery/packaging/building/esbuild-bundler-port.ts",
    "!./src/infrastructure/node/**/*-port.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./src/infrastructure/git/*-port.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/**",
    "!./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/eslint/**",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const sourcesOutsideMechanisms = withoutProjectionOutputs({ sources: loadedOutsideMechanisms });

const NESTED_DECLARATION_KEY = projectionDeclarationKeyIn({ folder: "src/infrastructure/engines/eslint/runner" });

const UPGRADED_TREE: Readonly<Record<string, string>> = {
  [ROOT_PROJECTION_DECLARATION_KEY]: INSTALLED_DECLARATION_TEXT,
  [NESTED_DECLARATION_KEY]: INSTALLED_DECLARATION_TEXT,
};

const runnerSources = import.meta.glob(
  [
    "./src/infrastructure/engines/*/runner/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./src/infrastructure/engines/*/runner/**/*.test.*",
    "!./src/infrastructure/engines/eslint/runner/native-exceptions/*/**",
    "!./src/infrastructure/engines/eslint/runner/projection/projection-pair/**",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts",
    "!./src/infrastructure/engines/audit/runner/toolchain/typescript-parse.ts",
    "!./src/infrastructure/engines/audit/runner/pieces/jsonc-parse.ts",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts",
    "!./src/infrastructure/engines/eslint/runner/native-exceptions/inline-config-parser.ts",
    "!./src/infrastructure/engines/eslint/runner/pieces/native-rules.ts",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const unlistedMechanismSources = import.meta.glob(
  [
    "./src/infrastructure/engines/audit/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "./src/infrastructure/engines/eslint/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./src/infrastructure/engines/**/*.test.*",
    "!./src/infrastructure/engines/*/runner/**",
    "!./src/infrastructure/engines/audit/*/*",
    "!./src/infrastructure/engines/audit/*/*/**",
    "!./src/infrastructure/engines/eslint/*/*",
    "!./src/infrastructure/engines/eslint/*/*/**",
    "!./src/infrastructure/engines/eslint/eslint-config-lookup.ts",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const platformPortSources = import.meta.glob(
  [
    "./src/infrastructure/node/**/*-port.{ts,mts,cts,tsx,js,mjs,cjs}",
    "./src/infrastructure/git/*-port.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./src/infrastructure/node/**/*.test.*",
    "!./src/infrastructure/git/*.test.*",
    "!./src/infrastructure/node/modules/module-loader-port.ts",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const moduleLoaderPortSources = import.meta.glob(["./src/infrastructure/node/modules/module-loader-port.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const installProofPortSources = import.meta.glob(["./delivery/install-proof/install-proof-ports.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const bundlerPortSources = import.meta.glob(["./delivery/packaging/building/esbuild-bundler-port.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const coreSources = import.meta.glob(
  [
    "./src/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./src/**/*.test.*",
    "!./src/audit.ts",
    "!./src/eslint-plugin.ts",
    "!./src/rule-set.ts",
    "!./src/testing.ts",
    "!./src/infrastructure/engines/audit/**",
    "!./src/infrastructure/engines/eslint/*/**",
    "!./src/application/run/check/cd1-cascade/**",
    "!./src/application/run/check/cd1-exempted/**",
    "!./src/infrastructure/command-line/documentation/walkthrough/**",
    "!./src/infrastructure/content-files/rule-sets/probe-rule-set/**",
    "!./src/infrastructure/content-files/rule-sets/team-rule-set/**",
    "!./src/operations/prune-debt/prune-debt/**",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const typescriptWrapperSources = import.meta.glob(["./src/infrastructure/engines/audit/runner/toolchain/typescript-parse.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const jsoncWrapperSources = import.meta.glob(["./src/infrastructure/engines/audit/runner/pieces/jsonc-parse.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const eslintInstanceSources = import.meta.glob(["./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const eslintToolchainSources = import.meta.glob(["./src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const typescriptLineSources = import.meta.glob(["./tests/typescript-parse-port.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const eslintLineSources = import.meta.glob(["./tests/eslint-toolchains.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const pluginKitWrapperSources = import.meta.glob(["./src/infrastructure/engines/eslint/runner/native-exceptions/inline-config-parser.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const nativeRulesWrapperSources = import.meta.glob(["./src/infrastructure/engines/eslint/runner/pieces/native-rules.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const walkerPieceSources = import.meta.glob(
  [
    "./src/infrastructure/engines/audit/*/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./src/infrastructure/engines/audit/runner/**",
    "!./src/infrastructure/engines/audit/**/*.test.*",
    "!./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/**/*.test.*",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const eslintPieceSources = import.meta.glob(
  [
    "./src/infrastructure/engines/eslint/*/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/eslint/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./src/infrastructure/engines/eslint/runner/**",
    "!./src/infrastructure/engines/eslint/**/*.test.*",
    "!./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/eslint/**/*.test.*",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const testSources = import.meta.glob(
  [
    "./**/*.test.{ts,mts,cts,tsx}",
    "./tests/required-entry.ts",
    "./tests/confinement.ts",
    "./tests/conformance-rows.ts",
    "!./node_modules/**",
    "!./artefacts/**",
    "!./delivery/install-proof/consumer-proof/**",
    "!./src/infrastructure/command-line/documentation/walkthrough/**",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const zodImport = packageImport({ packageName: "zod" });

const vitestImport = packageImport({ packageName: "vitest" });

const relativeImportUnderCoreFrom = ({ importingFolder }: { readonly importingFolder: string }) => [
  relativeImportReaching({
    importingFolder,
    reach: /^src\/(?!(?:audit|eslint-plugin|rule-set|testing)\.ts$|infrastructure\/engines\/(?:audit|eslint\/[^/]+)\/)/,
  }),
  packageOrComputedImport,
];

describe("Vendor confinement over what this repository's own Hone source imports, read as build-time raw modules (CD-19, CD-20; CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file through every scanned set, so no set is silently empty", () => {
    expect({
      sourcesOutsideMechanisms,
      runnerSources,
      platformPortSources,
      coreSources,
      installProofPortSources,
      bundlerPortSources,
      walkerPieceSources,
      eslintPieceSources,
      testSources,
      eslintLineSources,
      typescriptLineSources,
    }).toEqual({
      sourcesOutsideMechanisms: expect.objectContaining({
        "./src/application/run/check/run-check.ts": expect.any(String),
        "./delivery/install-proof/install-proof.ts": expect.any(String),
        "./delivery/install-proof/run-install-proof.ts": expect.any(String),
      }),
      runnerSources: expect.objectContaining({ "./src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts": expect.any(String) }),
      platformPortSources: expect.objectContaining({
        "./src/infrastructure/node/file-system/file-text-port.ts": expect.any(String),
        "./src/infrastructure/node/file-system/file-system-port.ts": expect.any(String),
        "./src/infrastructure/node/process/execution-port.ts": expect.any(String),
      }),
      coreSources: expect.objectContaining({ "./src/application/run/check/run-check.ts": expect.any(String) }),
      installProofPortSources: { "./delivery/install-proof/install-proof-ports.ts": expect.any(String) },
      bundlerPortSources: { "./delivery/packaging/building/esbuild-bundler-port.ts": expect.any(String) },
      walkerPieceSources: expect.objectContaining({
        "./src/infrastructure/engines/audit/CD-14/class-syntax.ts": expect.any(String),
        "./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts": expect.any(String),
      }),
      eslintPieceSources: expect.objectContaining({ "./src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts": expect.any(String) }),
      testSources: expect.objectContaining({
        "./src/application/run/check/run-check.test.ts": expect.any(String),
        "./src/infrastructure/node/file-system/file-system-port.test.ts": expect.any(String),
        "./src/infrastructure/node/process/execution-port.test.ts": expect.any(String),
        "./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.test.ts": expect.any(String),
        "./tests/required-entry.ts": expect.any(String),
        "./tests/confinement.ts": expect.any(String),
      }),
      eslintLineSources: { "./tests/eslint-toolchains.ts": expect.any(String) },
      typescriptLineSources: { "./tests/typescript-parse-port.ts": expect.any(String) },
    });
  });

  it("finds no mechanism source outside a runner folder or a audit or ESLint piece folder", () => {
    expect(unlistedMechanismSources).toEqual({});
  });

  it("finds every relative import in a core file resolving under core/", () => {
    expect(
      importsOutsideFromOwnFolder({ sources: coreSources, allowedFrom: relativeImportUnderCoreFrom }),
    ).toEqual([]);
  });

  it("finds every file outside the mechanisms, platform ports, probe pieces and tests importing only relative paths and zod", () => {
    expect(importsOutside({ sources: sourcesOutsideMechanisms, allowed: [relativeImport, zodImport] })).toEqual([]);
  });

  it("finds the root declaration hone project writes importing a vendor package when nothing is left out, and a declaration of that name in a folder too", () => {
    expect(importsOutside({ sources: UPGRADED_TREE, allowed: [relativeImport, zodImport] })).toEqual([
      { file: ROOT_PROJECTION_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
      { file: NESTED_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
    ]);
  });

  it("finds only the declaration of that name in a folder, once the root declaration hone project writes is left out", () => {
    expect(importsOutside({ sources: withoutProjectionOutputs({ sources: UPGRADED_TREE }), allowed: [relativeImport, zodImport] })).toEqual([
      { file: NESTED_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
    ]);
  });

  it("finds every runner file outside the wrapping files importing only relative paths and zod", () => {
    expect(importsOutside({ sources: runnerSources, allowed: [relativeImport, zodImport] })).toEqual([]);
  });

  it("finds the platform ports other than the module loader importing only relative paths, zod and node builtins", () => {
    expect(
      importsOutside({ sources: platformPortSources, allowed: [relativeImport, zodImport, nodeBuiltinImport] }),
    ).toEqual([]);
  });

  it("finds the module-loader port importing only relative paths, zod, node builtins and computed module loads", () => {
    expect(
      importsOutside({
        sources: moduleLoaderPortSources,
        allowed: [relativeImport, zodImport, nodeBuiltinImport, computedModuleLoad],
      }),
    ).toEqual([]);
  });

  it("finds delivery/install-proof/install-proof-ports.ts, the install proof's wrapping ports, importing only relative paths and node builtins", () => {
    expect(importsOutside({ sources: installProofPortSources, allowed: [relativeImport, nodeBuiltinImport] })).toEqual([]);
  });

  it("finds delivery/packaging/building/esbuild-bundler-port.ts, the package build's wrapping port, the only file importing esbuild, beside relative paths and node builtins", () => {
    expect(
      importsOutside({ sources: bundlerPortSources, allowed: [relativeImport, nodeBuiltinImport, packageImport({ packageName: "esbuild" })] }),
    ).toEqual([]);
  });

  it("finds typescript-parse.ts the only file loading typescript, by a dynamic import that core can answer with a named failure", () => {
    expect(
      importsOutside({
        sources: typescriptWrapperSources,
        allowed: [
          relativeImport,
          zodImport,
          packageTypeImport({ packageName: "typescript" }),
          packageDynamicImport({ packageName: "typescript" }),
        ],
      }),
    ).toEqual([]);
  });

  it("finds jsonc-parse.ts importing only relative paths, zod and jsonc-parser", () => {
    expect(
      importsOutside({
        sources: jsoncWrapperSources,
        allowed: [relativeImport, zodImport, packageImport({ packageName: "jsonc-parser" })],
      }),
    ).toEqual([]);
  });

  it("finds eslint-toolchain.ts the only file loading the adopter's ESLint toolchain, each package by a dynamic import that core can answer with a named failure", () => {
    expect(
      importsOutside({
        sources: eslintToolchainSources,
        allowed: [
          relativeImport,
          zodImport,
          dynamicLoadMatching({ specifier: /^`\.\/\$\{folder\}\/eslint-\$\{major\}-boundary\.ts`$/ }),
          packageTypeImport({ packageName: "@typescript-eslint/eslint-plugin" }),
          packageDynamicImport({ packageName: "eslint" }),
          packageDynamicImport({ packageName: "@typescript-eslint/parser" }),
          packageDynamicImport({ packageName: "@typescript-eslint/eslint-plugin" }),
        ],
      }),
    ).toEqual([]);
  });

  it("finds eslint-instance.ts taking only types from eslint and @typescript-eslint/parser", () => {
    expect(
      importsOutside({
        sources: eslintInstanceSources,
        allowed: [
          relativeImport,
          zodImport,
          packageTypeImport({ packageName: "eslint" }),
          packageTypeImport({ packageName: "@typescript-eslint/parser" }),
        ],
      }),
    ).toEqual([]);
  });

  it("finds inline-config-parser.ts the only file importing @eslint/plugin-kit by value", () => {
    expect(
      importsOutside({
        sources: pluginKitWrapperSources,
        allowed: [relativeImport, zodImport, packageImport({ packageName: "@eslint/plugin-kit" })],
      }),
    ).toEqual([]);
  });

  it("finds native-rules.ts the only file importing ESLint's core rules and @typescript-eslint/eslint-plugin by value", () => {
    expect(
      importsOutside({
        sources: nativeRulesWrapperSources,
        allowed: [
          packageImport({ packageName: "eslint/use-at-your-own-risk" }),
          packageImport({ packageName: "@typescript-eslint/eslint-plugin" }),
        ],
      }),
    ).toEqual([]);
  });

  it("finds audit pieces taking only types from typescript", () => {
    expect(
      importsOutside({
        sources: walkerPieceSources,
        allowed: [relativeImport, zodImport, packageTypeImport({ packageName: "typescript" })],
      }),
    ).toEqual([]);
  });

  it("finds ESLint pieces taking only types from eslint", () => {
    expect(
      importsOutside({
        sources: eslintPieceSources,
        allowed: [relativeImport, zodImport, packageTypeImport({ packageName: "eslint" })],
      }),
    ).toEqual([]);
  });

  it("finds tests/eslint-toolchains.ts the only test-support file loading the pinned ESLint lines, each by a dynamic import, and checking the native rule pieces with zod", () => {
    expect(
      importsOutside({
        sources: eslintLineSources,
        allowed: [
          relativeImportOfAnyForm,
          vitestImport,
          zodImport,
          packageDynamicImport({ packageName: "eslint-9" }),
          packageDynamicImport({ packageName: "eslint-9/use-at-your-own-risk" }),
        ],
      }),
    ).toEqual([]);
  });

  it("finds tests/typescript-parse-port.ts the only test-support file loading the pinned TypeScript floor, by a dynamic import, and checking its exports with zod", () => {
    expect(
      importsOutside({
        sources: typescriptLineSources,
        allowed: [relativeImportOfAnyForm, vitestImport, zodImport, packageDynamicImport({ packageName: "typescript-floor" })],
      }),
    ).toEqual([]);
  });

  it("finds every test file and the test-support modules importing only relative paths and vitest, type-only imports included, so zod, eslint and typescript reach a test only through their owners", () => {
    expect(importsOutside({ sources: testSources, allowed: [relativeImportOfAnyForm, vitestImport] })).toEqual([]);
  });
});

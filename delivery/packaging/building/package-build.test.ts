import { describe, expect, it, vi } from "vitest";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import type { Result } from "../../../src/domain/result.ts";
import { ENTRY_DECLARATIONS, emittingDeclarations } from "../../../tests/emitting-declarations.ts";
import { inMemoryFiles } from "../../../tests/in-memory-files.ts";
import { recordingBundler } from "../../../tests/recording-bundler.ts";
import type { Bundle, BundledOutput, BundleFailure, BundlerPort } from "./esbuild-bundler-port.ts";
import { buildPackage } from "./package-build.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const STAGE_SOURCE = "/tmp/hailstails-hone-package-stage-1/source";

const developmentManifestDeclaring = (request: { readonly dependencies: string }): string =>
  `{ "version": "0.0.0", "private": true, "type": "module", "description": "Runs disciplines.", "keywords": ["disciplines"], "license": "MIT-0", "author": "Example Author", "engines": { "node": ">=22.18.0" }, "dependencies": ${request.dependencies}, "peerDependencies": { "eslint": "^9.28.0 || ^10.0.0", "typescript": ">=4.8.4 <7.0.0" }, "peerDependenciesMeta": { "eslint": { "optional": true }, "typescript": { "optional": true } }, "devDependencies": { "esbuild": "0.25.12" } }`;

const DEVELOPMENT_MANIFEST = developmentManifestDeclaring({ dependencies: '{ "zod": "^4.4.3" }' });

const LOCK = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      levn:
        specifier: ^0.4.1
        version: 0.4.1
      zod:
        specifier: ^4.4.3
        version: 4.4.3
snapshots:
  zod@4.4.3: {}
`;

const SOURCE: Readonly<Record<string, string>> = {
  "/package/package.json": DEVELOPMENT_MANIFEST,
  "/package/tsconfig.json": '{ "extends": "./tsconfig.base.json" }',
  "/package/tsconfig.base.json": '{ "compilerOptions": { "strict": true } }',
  "/package/README.md": "# Hone\n\n[Rules](rules/CD-15/README.md)\n",
  "/package/LICENSE": "MIT No Attribution\n",
  "/package/pnpm-lock.yaml": LOCK,
  "/package/src/audit.ts": "export const folderScope = 1;\n",
  "/package/src/eslint-plugin.ts": "export default {};\n",
  "/package/src/rule-set.ts": "export {};\n",
  "/package/src/testing.ts": "export const repoPathOf = 1;\n",
  "/package/src/hone.ts": "await run();\n",
  "/package/src/application/run/check/run-check.test.ts": "test\n",
  "/package/src/tests/helper.ts": "export const helper = 1;\n",
  "/package/src/infrastructure/engines/typescript-compiler/runner/runner.ts": "export const runner = {};\n",
  "/package/src/infrastructure/engines/typescript-compiler/CD-15/piece.json": '{ "version": 1, "clauses": [ { "clause": "loops", "settings": { "module": "loops.ts" } } ] }',
  "/package/src/infrastructure/engines/typescript-compiler/CD-15/loops.ts": "export const check = {};\n",
  "/package/rules/CD-15/discipline.json": '{ "version": 1 }\n',
  "/package/rules/CD-15/README.md": "# CD-15\n",
  "/package/docs/why-chain-contract.md": "# Why-chain contract\n",
};

const entryOutput = (request: { readonly source: string; readonly path: string; readonly text: string }): BundledOutput => ({
  path: request.path,
  text: request.text,
  entryPoint: request.source,
  inputs: [request.source],
  externalImports: ["node:fs"],
});

const CHUNK: BundledOutput = {
  path: "chunks/chunk-A.js",
  text: "export {};\n",
  entryPoint: undefined,
  inputs: ["src/domain/result.ts"],
  externalImports: ["typescript", "eslint/use-at-your-own-risk", "zod"],
};

const TOOL_COMMAND = entryOutput({
  source: "src/hone.ts",
  path: "src/hone.js",
  text: "#!/usr/bin/env node\nawait run();\n",
});

const API_AUDIT = entryOutput({ source: "src/audit.ts", path: "src/audit.js", text: "export const folderScope = 1;\n" });

const API_ESLINT_PLUGIN = entryOutput({ source: "src/eslint-plugin.ts", path: "src/eslint-plugin.js", text: "export default {};\n" });

const API_RULE_SET = entryOutput({ source: "src/rule-set.ts", path: "src/rule-set.js", text: "export {};\n" });

const API_TESTING = entryOutput({ source: "src/testing.ts", path: "src/testing.js", text: "export const repoPathOf = 1;\n" });

const RUNNER = entryOutput({ source: "src/infrastructure/engines/typescript-compiler/runner/runner.ts", path: "src/infrastructure/engines/typescript-compiler/runner/runner.js", text: "export const runner = {};\n" });

const LOOPS = entryOutput({ source: "src/infrastructure/engines/typescript-compiler/CD-15/loops.ts", path: "src/infrastructure/engines/typescript-compiler/CD-15/loops.js", text: "export const check = {};\n" });

const BUNDLE: Bundle = {
  outputs: [TOOL_COMMAND, API_AUDIT, API_ESLINT_PLUGIN, API_RULE_SET, API_TESTING, RUNNER, LOOPS, CHUNK],
  packageRoots: [],
};

const bundlerReturning = (bundle: Result<Bundle, BundleFailure>): BundlerPort => ({
  bundle: vi.fn<BundlerPort["bundle"]>().mockResolvedValue(bundle),
});

const withOutputs = (outputs: readonly BundledOutput[]): BundlerPort => bundlerReturning({ outcome: "ok", value: { ...BUNDLE, outputs } });

const builtWith = (request: { readonly source: Readonly<Record<string, string>>; readonly bundler: BundlerPort }) => {
  const files = inMemoryFiles({ initial: { ...request.source, "/out/stale.js": "stale\n" } });
  return {
    files,
    built: buildPackage({
      ports: {
        path: posixPath,
        fileText: files.fileText,
        scratch: files.scratch,
        bundler: request.bundler,
        declarations: emittingDeclarations({ declarations: ENTRY_DECLARATIONS }),
      },
      packageRoot: "/package",
      outputRoot: "/out",
    }),
  };
};

const SHIPPED_FILES = [
  "LICENSE",
  "README.md",
  "chunks/chunk-A.js",
  "docs/why-chain-contract.md",
  "package.json",
  "rules/CD-15/README.md",
  "rules/CD-15/discipline.json",
  "src/audit.d.ts",
  "src/audit.js",
  "src/domain/result.d.ts",
  "src/eslint-plugin.d.ts",
  "src/eslint-plugin.js",
  "src/hone.js",
  "src/infrastructure/engines/typescript-compiler/CD-15/loops.js",
  "src/infrastructure/engines/typescript-compiler/CD-15/piece.json",
  "src/infrastructure/engines/typescript-compiler/runner/runner.js",
  "src/rule-set.d.ts",
  "src/rule-set.js",
  "src/testing.d.ts",
  "src/testing.js",
];

const NOTHING_WRITTEN = { "/out/stale.js": "stale\n" };

describe("buildPackage", () => {
  it("bundles the command, the public entries, the runners and the shipped piece modules from a stage holding only core's code and the rule data it imports, with each peer and each dependency external", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const recording = recordingBundler({ files, stage: STAGE_SOURCE, bundle: { outcome: "ok", value: BUNDLE } });

    await buildPackage({
      ports: {
        path: posixPath,
        fileText: files.fileText,
        scratch: files.scratch,
        bundler: recording.bundler,
        declarations: emittingDeclarations({ declarations: ENTRY_DECLARATIONS }),
      },
      packageRoot: "/package",
      outputRoot: "/out",
    });

    expect({
      requests: recording.requests(),
      staged: recording.stagedWhenBundled(),
      left: files.pathsUnder({ folder: STAGE_SOURCE }),
    }).toEqual({
      requests: [
        {
          sourceRoot: STAGE_SOURCE,
          entryPoints: [
            "src/hone.ts",
            "src/audit.ts",
            "src/eslint-plugin.ts",
            "src/rule-set.ts",
            "src/testing.ts",
            "src/infrastructure/engines/typescript-compiler/runner/runner.ts",
            "src/infrastructure/engines/typescript-compiler/CD-15/loops.ts",
          ],
          external: ["eslint", "eslint/*", "typescript", "typescript/*", "zod", "zod/*"],
          target: "node22.18",
        },
      ],
      staged: [
        "package.json",
        "rules/CD-15/README.md",
        "rules/CD-15/discipline.json",
        "src/audit.ts",
        "src/eslint-plugin.ts",
        "src/hone.ts",
        "src/infrastructure/engines/typescript-compiler/CD-15/loops.ts",
        "src/infrastructure/engines/typescript-compiler/CD-15/piece.json",
        "src/infrastructure/engines/typescript-compiler/runner/runner.ts",
        "src/rule-set.ts",
        "src/testing.ts",
        "tsconfig.base.json",
        "tsconfig.json",
      ],
      left: [],
    });
  });

  it("replaces the output root with the bundle, the shipped documents and data, the built pieces and the published manifest, and no third-party notices", async () => {
    const { files, built } = builtWith({ source: SOURCE, bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }) });

    const packaged = await built;

    expect({ packaged, written: files.pathsUnder({ folder: "/out" }) }).toEqual({
      packaged: { outcome: "ok", value: { outputRoot: "/out", files: SHIPPED_FILES } },
      written: SHIPPED_FILES,
    });
  });

  it("writes the published manifest naming every top-level entry and each dependency at its declared caret range, and the built piece naming its .js module", async () => {
    const { files, built } = builtWith({ source: SOURCE, bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }) });

    await built;

    expect(files.texts()).toMatchObject({
      "/out/package.json": expect.stringContaining('"dependencies": {\n    "zod": "^4.4.3"\n  },'),
    });
    expect(files.texts()).toMatchObject({
      "/out/package.json": expect.stringContaining(
        '"files": [\n    "LICENSE",\n    "README.md",\n    "chunks",\n    "docs",\n    "rules",\n    "src"\n  ]',
      ),
      "/out/src/infrastructure/engines/typescript-compiler/CD-15/piece.json": expect.stringContaining('"module": "loops.js"'),
    });
  });

  it("ships the declarations the typed entries reach beside each entry's bundled module, and exports each entry under the types and default conditions", async () => {
    const { files, built } = builtWith({ source: SOURCE, bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }) });

    await built;

    expect(files.texts()).toMatchObject({
      "/out/src/audit.d.ts": 'export type { Result } from "./domain/result.js";\n',
      "/out/src/audit.js": "export const folderScope = 1;\n",
      "/out/src/testing.d.ts": "export declare const repoPathOf: 1;\n",
      "/out/src/domain/result.d.ts": "export type Result = 1;\n",
      "/out/package.json": expect.stringContaining(
        '"./audit": {\n      "types": "./src/audit.d.ts",\n      "default": "./src/audit.js"\n    },\n    "./eslint-plugin": {\n      "types": "./src/eslint-plugin.d.ts",\n      "default": "./src/eslint-plugin.js"\n    },\n    "./rule-set": {\n      "types": "./src/rule-set.d.ts",\n      "default": "./src/rule-set.js"\n    },\n    "./testing": {\n      "types": "./src/testing.d.ts",\n      "default": "./src/testing.js"\n    }',
      ),
    });
  });

  it("fails naming each output that imports a package declared neither as a peer nor as a dependency, writing nothing", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: withOutputs([TOOL_COMMAND, API_AUDIT, API_ESLINT_PLUGIN, API_RULE_SET, API_TESTING, RUNNER, LOOPS, { ...CHUNK, externalImports: ["levn", "typescript"] }]),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: bundle: an output imports what is neither a node: builtin, a declared peer nor a declared dependency: chunks/chunk-A.js imports levn",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming an entry whose code was moved into a shared chunk, writing nothing", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: withOutputs([TOOL_COMMAND, API_AUDIT, API_ESLINT_PLUGIN, API_RULE_SET, API_TESTING, { ...RUNNER, inputs: [] }, LOOPS, CHUNK]),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error:
          "FAIL: bundle: an entry would not find the install root from its own module: src/infrastructure/engines/typescript-compiler/runner/runner.ts is not emitted with its own code at src/infrastructure/engines/typescript-compiler/runner/runner.js",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming a dependency published as a range wider than a caret, or from another floor than the version core's lock holds, before bundling, writing nothing", async () => {
    const bundler = bundlerReturning({ outcome: "ok", value: BUNDLE });
    const { files, built } = builtWith({
      source: { ...SOURCE, "/package/package.json": developmentManifestDeclaring({ dependencies: '{ "zod": ">=4.4.3", "levn": "^0.4.0" }' }) },
      bundler,
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }), bundled: vi.mocked(bundler.bundle).mock.calls }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: the published dependency ranges do not start at the versions pnpm-lock.yaml locks: zod is published as >=4.4.3, which is not a caret range of one release; levn is published as ^0.4.0, whose floor is not the locked 0.4.1",
      },
      written: NOTHING_WRITTEN,
      bundled: [],
    });
  });

  it("fails naming a dependency of core the lock does not hold, writing nothing", async () => {
    const { files, built } = builtWith({
      source: { ...SOURCE, "/package/package.json": developmentManifestDeclaring({ dependencies: '{ "zod": "^4.4.3", "other": "^1.0.0" }' }) },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: { outcome: "failed", error: "FAIL: read /package/pnpm-lock.yaml: core depends on other, which the lock does not hold" },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming each installed package whose code the bundle carries, writing nothing", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: bundlerReturning({ outcome: "ok", value: { ...BUNDLE, packageRoots: ["node_modules/zod"] } }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: bundle: an output carries an installed package's code, which the package imports by name instead: node_modules/zod is bundled into the package",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming a shipped page that names a Hone version or versioned tarball, writing nothing", async () => {
    const { files, built } = builtWith({
      source: { ...SOURCE, "/package/README.md": "# Hone\n\nInstall `hailstails-hone-0.0.1.tgz`, version 0.0.0.\n" },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: a shipped page names a Hone version, which goes stale on the next release: README.md names hailstails-hone-0.0.1.tgz; README.md names 0.0.0",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("ships the changelog the release writes, though it names the version being built", async () => {
    const changelog = "# Changelog\n\n## 0.0.0\n\n### Fixes\n\n- read the right line (#1)\n";
    const { files, built } = builtWith({
      source: { ...SOURCE, "/package/CHANGELOG.md": changelog },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: (await built).outcome, shipped: files.textsUnder({ folder: "/out" })["/out/CHANGELOG.md"] }).toEqual({
      result: "ok",
      shipped: changelog,
    });
  });

  it("still fails naming a guide page that names the version being built when the changelog ships beside it", async () => {
    const { built } = builtWith({
      source: { ...SOURCE, "/package/CHANGELOG.md": "# Changelog\n\n## 0.0.0\n", "/package/README.md": "# Hone\n\nVersion 0.0.0.\n" },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect(await built).toEqual({
      outcome: "failed",
      error: "FAIL: a shipped page names a Hone version, which goes stale on the next release: README.md names 0.0.0",
    });
  });

  it("fails naming a shipped page that links to a file the package does not ship, writing nothing", async () => {
    const { files, built } = builtWith({
      source: { ...SOURCE, "/package/README.md": "# Hone\n\n[Proof](tests/test-fixtures/walkthrough/)\n" },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: a shipped page links to a file the package does not ship: README.md links to tests/test-fixtures/walkthrough",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails with the bundler's detail, writing nothing and leaving no stage behind", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: bundlerReturning({ outcome: "failed", error: { kind: "bundle-failed", detail: 'Could not resolve "x"' } }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }), staged: files.pathsUnder({ folder: STAGE_SOURCE }) }).toEqual({
      result: { outcome: "failed", error: 'FAIL: bundle: Could not resolve "x"' },
      written: NOTHING_WRITTEN,
      staged: [],
    });
  });

  it("fails naming a shipped piece.json that is not JSON", async () => {
    const { built } = builtWith({
      source: { ...SOURCE, "/package/src/infrastructure/engines/typescript-compiler/CD-15/piece.json": "{ clauses" },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect(await built).toMatchObject({ outcome: "failed", error: expect.stringContaining("FAIL: plan src/infrastructure/engines/typescript-compiler/CD-15/piece.json:") });
  });
});

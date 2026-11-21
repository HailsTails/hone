import { afterEach, describe, expect, it, vi } from "vitest";
import type { PackageLocationPort } from "../../../../node/modules/package-location-port.ts";
import { ESLINT_LINES, eslintClassOn, eslintPeersOn } from "../../../../../../tests/eslint-toolchains.ts";
import { type EslintToolchainModules, type EslintToolchainPeers, eslintBoundaryFor, loadEslintToolchain } from "./eslint-toolchain.ts";

const REAL_10 = eslintPeersOn({ line: "eslint-10" });

const INSTALL_ROOT = "/repo/tools/hone";

const REPOSITORY_LOCATION: ReturnType<PackageLocationPort["locate"]> = { outcome: "ok", value: "/repo/node_modules/package/index.js" };

const ESLINT_UNRESOLVED: Error & { code?: string } = new Error(`Cannot find package 'eslint' imported from ${INSTALL_ROOT}/x.ts`);
ESLINT_UNRESOLVED.code = "ERR_MODULE_NOT_FOUND";

const PARSER_UNRESOLVED: Error & { code?: string } = new Error(`Cannot find package '@typescript-eslint/parser' imported from ${INSTALL_ROOT}/x.ts`);
PARSER_UNRESOLVED.code = "ERR_MODULE_NOT_FOUND";

const PLUGIN_UNRESOLVED: Error & { code?: string } = new Error(`Cannot find package '@typescript-eslint/eslint-plugin' imported from ${INSTALL_ROOT}/x.ts`);
PLUGIN_UNRESOLVED.code = "ERR_MODULE_NOT_FOUND";

const ESLINT_NOT_INSTALLED = { packageName: "eslint", peer: "optional", supported: "^9.39.5 || ^10.15.0", found: "not installed" };

const PARSER_NOT_INSTALLED = { packageName: "@typescript-eslint/parser", peer: "optional", supported: "^8.73.0", found: "not installed" };

const PLUGIN_NOT_INSTALLED = { packageName: "@typescript-eslint/eslint-plugin", peer: "optional", supported: "^8.73.0", found: "not installed" };

const locatedBy = (locate: PackageLocationPort["locate"]): EslintToolchainPeers => ({
  ...REAL_10,
  location: { installRoot: INSTALL_ROOT, installForm: "package", locate },
});

describe("loadEslintToolchain over the development install", () => {
  it.each(ESLINT_LINES)("loads the %s toolchain and names the ESLint version it loaded", async (line) => {
    await expect(loadEslintToolchain({ peers: eslintPeersOn({ line }) })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        eslintVersion: expect.stringMatching(/^(9|10)\./),
        createEslint: expect.any(Function),
        typescriptParser: expect.objectContaining({ parseForESLint: expect.any(Function) }),
      },
    });
  });

  it("asks where eslint, the parser and the plugin resolve, and never typescript, which the parser bounds", async () => {
    const locate = vi.fn<PackageLocationPort["locate"]>().mockReturnValue(REPOSITORY_LOCATION);
    await loadEslintToolchain({ peers: locatedBy(locate) });
    expect(locate.mock.calls).toEqual([
      [{ packageName: "eslint" }],
      [{ packageName: "@typescript-eslint/parser" }],
      [{ packageName: "@typescript-eslint/eslint-plugin" }],
    ]);
  });
});

describe("loadEslintToolchain when a peer is missing, unsupported or shadowed", () => {
  it("names eslint as not installed, with the supported range, when it alone does not resolve", async () => {
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockThrowOnce(ESLINT_UNRESOLVED)
      .mockReturnValue(REPOSITORY_LOCATION);
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", peers: [ESLINT_NOT_INSTALLED] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["8.57.1", "9.11.1", "11.0.0"])("names the installed eslint %s as outside the supported range", async (version) => {
    vi.spyOn(await eslintClassOn({ line: "eslint-10" }), "version", "get").mockReturnValue(version);
    await expect(loadEslintToolchain({ peers: REAL_10 })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", peers: [{ ...ESLINT_NOT_INSTALLED, found: version }] },
    });
  });

  it("names @typescript-eslint/parser as not installed when it does not resolve", async () => {
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockReturnValueOnce(REPOSITORY_LOCATION)
      .mockThrowOnce(PARSER_UNRESOLVED)
      .mockReturnValue(REPOSITORY_LOCATION);
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", peers: [PARSER_NOT_INSTALLED] },
    });
  });

  it("names @typescript-eslint/eslint-plugin as not installed when it does not resolve", async () => {
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockReturnValueOnce(REPOSITORY_LOCATION)
      .mockReturnValueOnce(REPOSITORY_LOCATION)
      .mockThrow(PLUGIN_UNRESOLVED);
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", peers: [PLUGIN_NOT_INSTALLED] },
    });
  });

  it("names eslint as shadowed when it resolves from inside the core install, and never loads it", async () => {
    const eslint = vi.fn<EslintToolchainModules["eslint"]>();
    await expect(
      loadEslintToolchain({
        peers: {
          location: { installRoot: INSTALL_ROOT, installForm: "package", locate: () => ({ outcome: "ok", value: `${INSTALL_ROOT}/node_modules/eslint/lib/api.js` }) },
          modules: { ...REAL_10.modules, eslint },
        },
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "toolchain-shadowed",
        packageName: "eslint",
        location: `${INSTALL_ROOT}/node_modules/eslint/lib/api.js`,
        installRoot: INSTALL_ROOT,
      },
    });
    expect(eslint).not.toHaveBeenCalled();
  });
});

describe("loadEslintToolchain when more than one peer is unavailable", () => {
  it("names every ESLint peer that does not resolve in one failure, so one install fixes them all", async () => {
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockReturnValueOnce(REPOSITORY_LOCATION)
      .mockThrowOnce(PARSER_UNRESOLVED)
      .mockThrowOnce(PLUGIN_UNRESOLVED);
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", peers: [PARSER_NOT_INSTALLED, PLUGIN_NOT_INSTALLED] },
    });
  });

  it("names the shadowed peer rather than the missing ones when one resolves from inside the core install", async () => {
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockThrowOnce(ESLINT_UNRESOLVED)
      .mockReturnValueOnce({ outcome: "ok", value: `${INSTALL_ROOT}/node_modules/@typescript-eslint/parser/dist/index.js` })
      .mockThrowOnce(PLUGIN_UNRESOLVED);
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "toolchain-shadowed",
        packageName: "@typescript-eslint/parser",
        location: `${INSTALL_ROOT}/node_modules/@typescript-eslint/parser/dist/index.js`,
        installRoot: INSTALL_ROOT,
      },
    });
  });

  it("names only eslint, never importing the plugin, when eslint is missing and the installed plugin would fail on it", async () => {
    const typescriptEslintPlugin = vi
      .fn<EslintToolchainModules["typescriptEslintPlugin"]>()
      .mockRejectedValue(new Error("Cannot find module 'eslint'\nRequire stack:\n- /repo/node_modules/@typescript-eslint/eslint-plugin/dist/index.js"));
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockThrowOnce(ESLINT_UNRESOLVED)
      .mockReturnValue(REPOSITORY_LOCATION);
    await expect(
      loadEslintToolchain({ peers: { ...locatedBy(locate), modules: { ...REAL_10.modules, typescriptEslintPlugin } } }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "toolchain-unavailable", peers: [ESLINT_NOT_INSTALLED] } });
    expect(typescriptEslintPlugin).not.toHaveBeenCalled();
  });

  it("still names a plugin that is not installed when eslint is missing too", async () => {
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockThrowOnce(ESLINT_UNRESOLVED)
      .mockReturnValueOnce(REPOSITORY_LOCATION)
      .mockThrowOnce(PLUGIN_UNRESOLVED);
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", peers: [ESLINT_NOT_INSTALLED, PLUGIN_NOT_INSTALLED] },
    });
  });
});
describe("eslintBoundaryFor", () => {
  it("chooses the ESLint 9 boundary for an ESLint 9 release", async () => {
    await expect(eslintBoundaryFor({ version: "9.39.5" })).resolves.toMatchObject({
      outcome: "ok",
      value: { nearestLookup: { flags: ["v10_config_lookup_from_file"] } },
    });
  });

  it("chooses the ESLint 10 boundary for an ESLint 10 release", async () => {
    await expect(eslintBoundaryFor({ version: "10.15.0" })).resolves.toMatchObject({ outcome: "ok", value: { nearestLookup: { flags: [] } } });
  });

  it("fails naming the release of an ESLint major that has no boundary", async () => {
    await expect(eslintBoundaryFor({ version: "8.57.0" })).resolves.toEqual({ outcome: "failed", error: "no ESLint boundary exists for ESLint 8.57.0" });
  });
});

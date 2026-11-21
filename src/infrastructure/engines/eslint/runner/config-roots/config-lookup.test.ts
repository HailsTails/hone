import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { overlaidFileText } from "../../../../../../tests/overlaid-file-text.ts";
import type { EslintConfigLookup } from "../../eslint-config-lookup.ts";
import { configLookupDeclaring, teamConfigLookupFor } from "./config-lookup.ts";

const REPO = absolutePathSchema.parse("/repo");

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const NEAREST = { outcome: "ok", value: { kind: "nearest-to-file" } };

const ROOT_CONFIG = { "/repo/eslint.config.mjs": "" };

const noFiles: FileTextPort = {
  read: ({ path: requested }) => ({ outcome: "failed", error: { kind: "unreadable", path: requested, detail: "absent" } }),
  exists: () => "absent",
  write: vi.fn<FileTextPort["write"]>(),
};

const eslintInstalled = (request: { readonly version: string }) => ({
  "/repo/node_modules/eslint/package.json": `{ "version": "${request.version}" }`,
});

const lintScript = (request: { readonly command: string }) => ({
  "/repo/package.json": `{ "scripts": { "lint": "${request.command}" } }`,
});

const lookupDeclaring = (request: { readonly files: Readonly<Record<string, string>>; readonly declared: EslintConfigLookup | undefined }) => {
  const lookupRequest = {
    fileText: overlaidFileText({ base: noFiles, files: request.files }),
    path,
    repoRoot: REPO,
    trackedPaths: [repoPathSchema.parse("package.json")],
  };
  return teamConfigLookupFor({
    ...lookupRequest,
    settingsFile: "hone.config.json",
    lookup: configLookupDeclaring({ ...lookupRequest, declared: request.declared }),
  });
};

const lookupOver = (request: { readonly files: Readonly<Record<string, string>> }) => lookupDeclaring({ ...request, declared: undefined });

describe("teamConfigLookupFor", () => {
  it("names the settings file it was given when the repository root has no config for a root-only lookup", () => {
    expect(lookupDeclaring({ files: eslintInstalled({ version: "9.39.5" }), declared: undefined })).toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "the repository root has no eslint.config.* for a root-only config lookup; add one there, or set eslintConfigLookup to nearest-to-file in hone.config.json if ESLint runs from each package",
      },
    });
  });

  it.each([
    { name: "ESLint 10", files: { ...eslintInstalled({ version: "10.11.0" }), ...ROOT_CONFIG } },
    { name: "an ESLint that is not installed at the repository root", files: ROOT_CONFIG },
    {
      name: "ESLint 9 started with --flag v10_config_lookup_from_file",
      files: {
        ...eslintInstalled({ version: "9.39.5" }),
        ...lintScript({ command: "eslint --flag v10_config_lookup_from_file ." }),
        ...ROOT_CONFIG,
      },
    },
    {
      name: "ESLint 9 started with --flag=unstable_config_lookup_from_file",
      files: {
        ...eslintInstalled({ version: "9.39.5" }),
        ...lintScript({ command: "pnpm exec eslint --flag=unstable_config_lookup_from_file ." }),
        ...ROOT_CONFIG,
      },
    },
  ])("looks configs up nearest to each file for $name", ({ files }) => {
    expect(lookupOver({ files })).toEqual(NEAREST);
  });

  it("looks only at the root config for ESLint 9 started without the lookup flag", () => {
    expect(
      lookupOver({ files: { ...eslintInstalled({ version: "9.39.5" }), ...lintScript({ command: "eslint ." }), ...ROOT_CONFIG } }),
    ).toEqual({
      outcome: "ok",
      value: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" },
    });
  });

  it("fails as an unloadable team config when ESLint 9 would find no root config", () => {
    expect(lookupOver({ files: { ...eslintInstalled({ version: "9.39.5" }), ...lintScript({ command: "eslint ." }) } })).toMatchObject({
      outcome: "failed",
      error: { kind: "team-config-unloadable" },
    });
  });

  it("lets a declared nearest-to-file win over detecting a plain ESLint 9 run", () => {
    expect(
      lookupDeclaring({
        files: { ...eslintInstalled({ version: "9.39.5" }), ...lintScript({ command: "turbo run lint" }), ...ROOT_CONFIG },
        declared: "nearest-to-file",
      }),
    ).toEqual(NEAREST);
  });

  it("lets a declared repository-root win over detecting ESLint 10", () => {
    expect(
      lookupDeclaring({
        files: { ...eslintInstalled({ version: "10.11.0" }), ...lintScript({ command: "eslint ." }), ...ROOT_CONFIG },
        declared: "repository-root",
      }),
    ).toEqual({
      outcome: "ok",
      value: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" },
    });
  });
});

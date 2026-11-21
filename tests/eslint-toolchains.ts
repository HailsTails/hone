import { assert } from "vitest";
import { z } from "zod";
import type { EmbeddedRunner } from "../src/infrastructure/engines/protocol/embedded/embedded-runner-module-schema.ts";
import type { RunnerFailure } from "../src/application/ports/runner-failure.ts";
import { toolchainBoundChecksRunner, toolchainBoundEmbeddedRunner } from "../src/infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import type { LoadedChecksRunner } from "../src/infrastructure/engines/protocol/checks/checks-runner-types.ts";
import { createDefaultFileRemovalPort } from "../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../src/infrastructure/node/path-port.ts";
import type { Result } from "../src/domain/result.ts";
import { createChecksRunner } from "../src/infrastructure/engines/eslint/runner/checks-runner/checks-runner.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import {
  createEslintPort,
  type EslintClass,
  type EslintPort,
  type EslintToolchain,
} from "../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { defaultNativeRuleSources, type NativeRuleSources } from "../src/infrastructure/engines/eslint/runner/pieces/native-rules.ts";

export type EslintLine = "eslint-10" | "eslint-9";

export const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly nativeRuleSources: () => Promise<NativeRuleSources>;
};

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/..`, installForm: "source" });

const RUNNER_MODULE_SUFFIX = "src/infrastructure/engines/eslint/runner/runner.ts";

const LINES: Readonly<Record<EslintLine, LineDefinition>> = {
  "eslint-10": {
    eslintVersion: /^10\./,
    modules: DEVELOPMENT_PEERS.modules,
    nativeRuleSources: () => Promise.resolve(defaultNativeRuleSources),
  },
  "eslint-9": {
    eslintVersion: /^9\./,
    modules: { ...DEVELOPMENT_PEERS.modules, eslint: () => import("eslint-9") },
    nativeRuleSources: () =>
      import("eslint-9/use-at-your-own-risk").then((eslintCore) => ({
        eslintCore: eslintCore.builtinRules,
        typescriptEslint: defaultNativeRuleSources.typescriptEslint,
      })),
  },
};

const ruleObjectSchema = z.custom<object>((ruleModule) => typeof ruleModule === "object" && ruleModule !== null);

const nativeRulePieceSchema = z.object({
  createPlugin: z.function({
    input: [
      z.object({
        eslintCore: z.custom<ReadonlyMap<string, object>>((coreRules) => coreRules instanceof Map),
        typescriptEslint: z.record(z.string(), ruleObjectSchema),
      }),
    ],
    output: z.unknown(),
  }),
});

export const eslintPeersOn = (request: { readonly line: EslintLine }): EslintToolchainPeers => ({
  location: DEVELOPMENT_PEERS.location,
  modules: LINES[request.line].modules,
});

export const loadedEslintToolchain = async (request: { readonly line: EslintLine }): Promise<EslintToolchain> => {
  const loaded = await loadEslintToolchain({ peers: eslintPeersOn(request) });
  assert(loaded.outcome === "ok", `the ${request.line} toolchain loads from the development install`);
  assert(
    LINES[request.line].eslintVersion.test(loaded.value.eslintVersion),
    `the ${request.line} toolchain runs ESLint ${loaded.value.eslintVersion}`,
  );
  return loaded.value;
};

export const eslintClassOn = (request: { readonly line: EslintLine }): Promise<EslintClass> =>
  LINES[request.line].modules.eslint().then((eslintModule) => eslintModule.ESLint);

export const eslintPortOn = async (request: { readonly line: EslintLine }): Promise<EslintPort> =>
  createEslintPort({ toolchain: await loadedEslintToolchain(request) });

const withNativeRuleSources = (request: { readonly namespace: unknown; readonly sources: NativeRuleSources }): unknown => {
  const piece = nativeRulePieceSchema.safeParse(request.namespace);
  return piece.success ? { default: piece.data.createPlugin(request.sources) } : request.namespace;
};

export const pieceModulesOn = (request: { readonly line: EslintLine; readonly base: ModuleLoaderPort }): ModuleLoaderPort => {
  const sources = LINES[request.line].nativeRuleSources();
  return {
    load: (load) =>
      Promise.all([request.base.load(load), sources]).then(([loaded, resolvedSources]) =>
        loaded.outcome === "failed"
          ? loaded
          : { outcome: "ok", value: withNativeRuleSources({ namespace: loaded.value, sources: resolvedSources }) },
      ),
  };
};

export const eslintRunnerOn = (request: { readonly line: EslintLine }): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadedEslintToolchain(request).then((toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain })),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
        fileText: createDefaultFileTextPort({}),
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

export const eslintChecksRunnerOn = (request: { readonly line: EslintLine }): LoadedChecksRunner =>
  toolchainBoundChecksRunner({
    toolchain: loadedEslintToolchain(request).then((toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain })),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createChecksRunner({
        fileText: createDefaultFileTextPort({}),
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

export const modulesServingRunner = (request: {
  readonly runnerSuffix: string;
  readonly runner: unknown;
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => ({
  load: (load) =>
    load.path.replaceAll("\\", "/").endsWith(request.runnerSuffix)
      ? Promise.resolve({ outcome: "ok", value: { runner: request.runner } })
      : request.base.load(load),
});

export const checkModulesOn = (request: { readonly line: EslintLine }): ModuleLoaderPort => {
  const pieces = pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) });
  return {
    load: (load) =>
      load.path.replaceAll("\\", "/").endsWith(RUNNER_MODULE_SUFFIX)
        ? Promise.resolve({ outcome: "ok", value: { runner: eslintRunnerOn(request), checksRunner: eslintChecksRunnerOn(request) } })
        : pieces.load(load),
  };
};

export const runnerModulesOn = (request: { readonly line: EslintLine; readonly base: ModuleLoaderPort }): ModuleLoaderPort =>
  modulesServingRunner({ runnerSuffix: RUNNER_MODULE_SUFFIX, runner: eslintRunnerOn({ line: request.line }), base: request.base });

export const defaultEslintPort: EslintPort = await eslintPortOn({ line: "eslint-10" });

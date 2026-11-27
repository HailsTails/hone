import type typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import { z } from "zod";

import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { InstallForm } from "../../../../node/modules/install-layout.ts";
import { createDefaultPackageLocationPort } from "../../../../node/modules/package-location-port.ts";
import type { DeepReadonly, Equal } from "../../../protocol/runner-module/type-equality.ts";
import {
  ESLINT_REQUIREMENT,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
} from "../../../protocol/toolchain/eslint-peer-requirements.ts";
import {
  gatheredPeerFailure,
  installedPeer,
  loadedPeer,
  type PeerToolchain,
} from "../../../protocol/toolchain/toolchain-requirement.ts";
import {
  createEslintOn,
  type EslintModule,
  type EslintToolchain,
  type TypescriptParser,
} from "./eslint-instance.ts";
import type { EslintMajorBoundary } from "./eslint-major-boundary.ts";

export type TypescriptEslintPluginModule = {
  readonly default: Pick<typeof typescriptEslintPlugin, "meta">;
};

export type TypescriptEslintRule =
  (typeof typescriptEslintPlugin)["rules"][keyof (typeof typescriptEslintPlugin)["rules"]];

export type EslintToolchainModules = {
  readonly eslint: () => Promise<EslintModule>;
  readonly typescriptParser: () => Promise<TypescriptParser>;
  readonly typescriptEslintPlugin: () => Promise<TypescriptEslintPluginModule>;
};

export type EslintToolchainPeers = PeerToolchain<EslintToolchainModules>;

type ToolchainLoad<T> = Promise<Result<T, RunnerFailure>>;

export {
  ESLINT_REQUIREMENT,
  ESLINT_TOOLCHAIN_REQUIREMENTS,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
} from "../../../protocol/toolchain/eslint-peer-requirements.ts";

export const defaultEslintToolchainModules: EslintToolchainModules = {
  eslint: () => import("eslint"),
  typescriptParser: () => import("@typescript-eslint/parser"),
  typescriptEslintPlugin: () => import("@typescript-eslint/eslint-plugin"),
};

const boundaryModuleSchema = z.object({
  eslintBoundary: z.object({
    nearestLookup: z.object({ flags: z.array(z.string()) }),
    declarationText: z.string(),
    reportDataOf: z.custom<EslintMajorBoundary["reportDataOf"]>(
      (candidate) => typeof candidate === "function",
    ),
  }),
});

export const isBoundaryModuleSchemaEqual: Equal<
  DeepReadonly<z.output<typeof boundaryModuleSchema>["eslintBoundary"]>,
  EslintMajorBoundary
> = true;

const SUPPORTED_MAJORS: ReadonlySet<number> = new Set([9, 10]);

export const eslintBoundaryFor = async (request: {
  readonly version: string;
}): Promise<Result<EslintMajorBoundary, string>> => {
  const major = Number.parseInt(request.version, 10);
  if (!SUPPORTED_MAJORS.has(major)) {
    return { outcome: "failed", error: `no ESLint boundary exists for ESLint ${request.version}` };
  }
  const folder = `eslint-${major}`;
  const loaded: unknown = await import(`./${folder}/eslint-${major}-boundary.ts`);
  const boundary = boundaryModuleSchema.safeParse(loaded);
  return boundary.success
    ? { outcome: "ok", value: boundary.data.eslintBoundary }
    : {
        outcome: "failed",
        error: `the ESLint ${major} boundary is malformed: ${z.prettifyError(boundary.error)}`,
      };
};

export const installedEslintBoundary = (): Promise<Result<EslintMajorBoundary, string>> =>
  defaultEslintToolchainModules
    .eslint()
    .then((installed) => eslintBoundaryFor({ version: installed.ESLint.version }));

export const defaultEslintToolchainPeers = (options: {
  readonly installRoot: string;
  readonly installForm: InstallForm;
}): EslintToolchainPeers => ({
  location: createDefaultPackageLocationPort(options),
  modules: defaultEslintToolchainModules,
});

const failureOf = <Loaded>(request: {
  readonly loaded: Result<Loaded, RunnerFailure>;
}): readonly RunnerFailure[] => (request.loaded.outcome === "failed" ? [request.loaded.error] : []);

const failedWith = (request: {
  readonly failures: readonly [RunnerFailure, ...RunnerFailure[]];
}): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: gatheredPeerFailure({ failures: request.failures }),
});

type BoundEslint = { readonly module: EslintModule; readonly boundary: EslintMajorBoundary };

const boundEslintOf = async (request: {
  readonly loaded: Result<EslintModule, RunnerFailure>;
}): Promise<Result<BoundEslint, RunnerFailure>> => {
  if (request.loaded.outcome === "failed") {
    return request.loaded;
  }
  const module = request.loaded.value;
  const boundary = await eslintBoundaryFor({ version: module.ESLint.version });
  return boundary.outcome === "ok"
    ? { outcome: "ok", value: { module, boundary: boundary.value } }
    : { outcome: "failed", error: { kind: "tool-failed", detail: boundary.error } };
};

const toolchainOf = (request: {
  readonly eslint: Result<BoundEslint, RunnerFailure>;
  readonly typescriptParser: Result<TypescriptParser, RunnerFailure>;
  readonly typescriptEslintPlugin: Result<TypescriptEslintPluginModule, RunnerFailure>;
}): Result<EslintToolchain, RunnerFailure> => {
  if (request.eslint.outcome === "failed") {
    return failedWith({
      failures: [
        request.eslint.error,
        ...failureOf({ loaded: request.typescriptParser }),
        ...failureOf({ loaded: request.typescriptEslintPlugin }),
      ],
    });
  }
  if (request.typescriptParser.outcome === "failed") {
    return failedWith({
      failures: [
        request.typescriptParser.error,
        ...failureOf({ loaded: request.typescriptEslintPlugin }),
      ],
    });
  }
  if (request.typescriptEslintPlugin.outcome === "failed") {
    return failedWith({ failures: [request.typescriptEslintPlugin.error] });
  }
  return {
    outcome: "ok",
    value: {
      eslintVersion: request.eslint.value.module.ESLint.version,
      boundary: request.eslint.value.boundary,
      createEslint: createEslintOn({
        eslintClass: request.eslint.value.module.ESLint,
        boundary: request.eslint.value.boundary,
      }),
      typescriptParser: request.typescriptParser.value,
    },
  };
};

export const loadEslintToolchain = (request: {
  readonly peers: EslintToolchainPeers;
}): ToolchainLoad<EslintToolchain> => {
  const eslint = loadedPeer({
    requirement: ESLINT_REQUIREMENT,
    location: request.peers.location,
    load: request.peers.modules.eslint,
    versionOf: (module) => module.ESLint.version,
  }).then((loaded) => boundEslintOf({ loaded }));
  const typescriptParser = loadedPeer({
    requirement: TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
    location: request.peers.location,
    load: request.peers.modules.typescriptParser,
    versionOf: (parser) => parser.version,
  });
  return Promise.all([eslint, typescriptParser]).then(([loadedEslint, loadedParser]) =>
    loadedEslint.outcome === "ok"
      ? loadedPeer({
          requirement: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
          location: request.peers.location,
          load: request.peers.modules.typescriptEslintPlugin,
          versionOf: (plugin) => plugin.default.meta.version,
        }).then((loadedPlugin) =>
          toolchainOf({
            eslint: loadedEslint,
            typescriptParser: loadedParser,
            typescriptEslintPlugin: loadedPlugin,
          }),
        )
      : installedPeer({
          requirement: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
          location: request.peers.location,
        }).then((installedPlugin) =>
          failedWith({
            failures: [
              loadedEslint.error,
              ...failureOf({ loaded: loadedParser }),
              ...failureOf({ loaded: installedPlugin }),
            ],
          }),
        ),
  );
};

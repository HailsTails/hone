import { assert } from "vitest";
import { z } from "zod";
import { toolchainBoundStandaloneRunner } from "../src/infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import type { RunnerFailure } from "../src/application/ports/runner-failure.ts";
import type { StandaloneRunner } from "../src/infrastructure/engines/protocol/runner-module/runner-module-schema.ts";
import { createDefaultEntryKindPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../src/infrastructure/node/path-port.ts";
import type { Result } from "../src/domain/result.ts";
import { createWalkerRunner } from "../src/infrastructure/engines/audit/runner/create-walker-runner.ts";
import type { SyntaxApi, TypeScriptParsePort } from "../src/infrastructure/engines/audit/runner/toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort, type TypeScriptPeers } from "../src/infrastructure/engines/audit/runner/toolchain/typescript-toolchain.ts";

export type TypeScriptLine = "typescript" | "typescript-floor";

export const TYPESCRIPT_LINES: readonly TypeScriptLine[] = ["typescript", "typescript-floor"];

const LINE_VERSIONS: Readonly<Record<TypeScriptLine, RegExp>> = { typescript: /^6\./, "typescript-floor": /^4\.8\.4$/ };

const floorTypeScriptSchema = z.object({
  default: z.custom<SyntaxApi>(
    (syntaxApi) =>
      typeof syntaxApi === "object" &&
      syntaxApi !== null &&
      typeof Reflect.get(syntaxApi, "createSourceFile") === "function" &&
      typeof Reflect.get(syntaxApi, "version") === "string",
  ),
});

const DEVELOPMENT_PEERS: TypeScriptPeers = defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/..`, installForm: "source" });

export const typeScriptPeersOn = (request: { readonly line: TypeScriptLine }): TypeScriptPeers => {
  switch (request.line) {
    case "typescript":
      return DEVELOPMENT_PEERS;
    case "typescript-floor":
      return {
        location: DEVELOPMENT_PEERS.location,
        modules: { typescript: () => import("typescript-floor").then((typescript) => floorTypeScriptSchema.parse(typescript)) },
      };
  }
};

export const parsePortOn = async (request: { readonly line: TypeScriptLine }): Promise<TypeScriptParsePort> => {
  const loaded = await loadParsePort({ peers: typeScriptPeersOn(request) });
  assert(loaded.outcome === "ok", `the ${request.line} line loads from the development install`);
  assert(
    LINE_VERSIONS[request.line].test(loaded.value.syntaxApi.version),
    `the ${request.line} line runs TypeScript ${loaded.value.syntaxApi.version}`,
  );
  return loaded.value;
};

export const auditRunnerOn = (request: { readonly line: TypeScriptLine }): StandaloneRunner =>
  toolchainBoundStandaloneRunner({
    toolchain: parsePortOn(request).then((parse): Result<TypeScriptParsePort, RunnerFailure> => ({ outcome: "ok", value: parse })),
    runnerOf: (parse) =>
      createWalkerRunner({
        fileText: createDefaultFileTextPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path: createDefaultPathPort({}),
        parse,
        entryKind: createDefaultEntryKindPort({}),
      }),
  });

export const defaultParsePort: TypeScriptParsePort = await parsePortOn({ line: "typescript" });

export const syntaxErrorsOn = async (request: {
  readonly line: TypeScriptLine;
  readonly sources: Readonly<Record<string, string>>;
}): Promise<readonly string[]> => {
  const syntaxApi = (await parsePortOn({ line: request.line })).syntaxApi;
  return Object.entries(request.sources).flatMap(([fileName, source]) =>
    (syntaxApi.transpileModule(source, { fileName, reportDiagnostics: true }).diagnostics ?? []).map(
      (diagnostic) => `${fileName}: ${syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
    ),
  );
};

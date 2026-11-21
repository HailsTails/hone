import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import { loadedPeer, type PeerToolchain, type ToolchainRequirement } from "../../../protocol/toolchain/toolchain-requirement.ts";
import { createDefaultPackageLocationPort } from "../../../../node/modules/package-location-port.ts";
import type { InstallForm } from "../../../../node/modules/install-layout.ts";
import type { Result } from "../../../../../domain/result.ts";
import { defaultTypeScriptModules, type SyntaxApi, type SyntaxNode, type TypeScriptModules, type TypeScriptParsePort } from "./typescript-parse.ts";

export type TypeScriptPeers = PeerToolchain<TypeScriptModules>;

export const TYPESCRIPT_REQUIREMENT: ToolchainRequirement = {
  packageName: "typescript",
  peer: "required",
  lines: [{ floor: "4.8.4", below: "7.0.0" }],
};

export const defaultTypeScriptPeers = (options: { readonly installRoot: string; readonly installForm: InstallForm }): TypeScriptPeers => ({
  location: createDefaultPackageLocationPort(options),
  modules: defaultTypeScriptModules,
});

const directChildren = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): readonly SyntaxNode[] => {
  const collected: SyntaxNode[] = [];
  request.syntaxApi.forEachChild(request.node, (child) => {
    collected.push(child);
  });
  return collected;
};

export const createParsePort = (options: { readonly syntaxApi: SyntaxApi }): TypeScriptParsePort => ({
  syntaxApi: options.syntaxApi,
  parse: (request) => options.syntaxApi.createSourceFile(request.fileName, request.source, options.syntaxApi.ScriptTarget.Latest, true),
  children: (request) => directChildren({ syntaxApi: options.syntaxApi, node: request.node }),
});

export const loadParsePort = (request: { readonly peers: TypeScriptPeers }): Promise<Result<TypeScriptParsePort, RunnerFailure>> =>
  loadedPeer({
    requirement: TYPESCRIPT_REQUIREMENT,
    location: request.peers.location,
    load: request.peers.modules.typescript,
    versionOf: (loaded) => loaded.default.version,
  }).then((loaded) =>
    loaded.outcome === "failed" ? loaded : { outcome: "ok", value: createParsePort({ syntaxApi: loaded.value.default }) },
  );

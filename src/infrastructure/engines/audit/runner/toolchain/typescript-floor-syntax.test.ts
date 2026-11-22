import { assert, describe, expect, it } from "vitest";
import type { SyntaxApi } from "./typescript-parse.ts";
import { loadParsePort, typeScriptPeersNamed } from "./typescript-toolchain.ts";

const floorPeers = typeScriptPeersNamed({ installRoot: `${import.meta.dirname}/../../../../../..`, installForm: "source", packageName: "typescript-floor" });

const floorSyntaxApi = async (): Promise<SyntaxApi> => {
  const loaded = await loadParsePort({ peers: floorPeers });
  assert(loaded.outcome === "ok", "the typescript-floor line loads from the development install");
  const syntaxApi = loaded.value.syntaxApi;
  assert(/^4\.8\.4$/.test(syntaxApi.version), `the typescript-floor line runs TypeScript ${syntaxApi.version}`);
  return syntaxApi;
};

const syntaxErrorsIn = (syntaxApi: SyntaxApi, sources: Readonly<Record<string, string>>): readonly string[] =>
  Object.entries(sources).flatMap(([fileName, source]) =>
    (syntaxApi.transpileModule(source, { fileName, reportDiagnostics: true }).diagnostics ?? []).map(
      (diagnostic) => `${fileName}: ${syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
    ),
  );

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const shippedSources = import.meta.glob(
  [
    "./src/**/*.ts",
    "!./src/**/*.test.ts",
    "!./src/audit.ts",
    "!./src/eslint-plugin.ts",
    "!./src/rule-set.ts",
    "!./src/testing.ts",
    "!./src/infrastructure/command-line/documentation/walkthrough/**",
    "!./src/infrastructure/content-files/rule-sets/probe-rule-set/**",
    "!./src/infrastructure/engines/eslint/runner/native-exceptions/*/**",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts",
    "!./src/operations/prune-debt/prune-debt/**",
  ],
  { base: "../../../../../../", query: "?raw", import: "default", eager: true },
);

describe("core's shipped source under the oldest supported TypeScript, read as build-time raw modules (CD-47: the shipped source is the assertion's subject; nothing is spawned or written)", () => {
  it("reads a known file, so the scanned set is not silently empty", () => {
    expect(shippedSources).toEqual(expect.objectContaining({ "./src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts": expect.any(String) }));
  });

  it("reports a syntax the oldest supported TypeScript cannot parse, naming the file, so the scan can fail", async () => {
    expect(syntaxErrorsIn(await floorSyntaxApi(), { "./a.ts": "export const a = {} satisfies object;\n" })).toEqual([
      "./a.ts: ',' expected.",
      "./a.ts: ',' expected.",
    ]);
  });

  it("parses every shipped file without a syntax error, since a repository whose ESLint lints the install parses it with its own TypeScript", async () => {
    expect(syntaxErrorsIn(await floorSyntaxApi(), shippedSources)).toEqual([]);
  });
});

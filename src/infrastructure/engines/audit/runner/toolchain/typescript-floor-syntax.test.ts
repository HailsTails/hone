import { describe, expect, it } from "vitest";
import { syntaxErrorsOn } from "../../../../../../tests/typescript-parse-port.ts";

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
    "!./src/application/run/check/cd1-cascade/**",
    "!./src/application/run/check/cd1-exempted/**",
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

  it("parses every shipped file without a syntax error, since a repository whose ESLint lints the install parses it with its own TypeScript", async () => {
    expect(await syntaxErrorsOn({ line: "typescript-floor", sources: shippedSources })).toEqual([]);
  });
});

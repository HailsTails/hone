import { describe, expect, it } from "vitest";
import { createPathPort } from "../../node/path-port.ts";
import { pieceImportFindings } from "./piece-import-rules.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const sources = import.meta.glob(
  [
    "./src/infrastructure/engines/*/*/**/*.ts",
    "!./src/infrastructure/engines/*/*/**/*.test.ts",
    "!./src/infrastructure/engines/protocol/**",
    "./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/*/*/**/*.ts",
    "!./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/*/*/**/*.test.ts",
  ],
  { base: "../../../../", query: "?raw", import: "default", eager: true },
);

const typePackageTexts = import.meta.glob(["./src/infrastructure/engines/*/runner/piece-type-packages.json"], {
  base: "../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const outcome = pieceImportFindings({
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
  installRoot: ".",
  ruleSetRoots: [".", "./src/infrastructure/content-files/rule-sets/probe-rule-set"],
  sources,
  typePackageTexts,
});

describe("FR-8 piece imports over what this repository's own piece source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("finds the install's class-keyword piece among the pieces it checks", () => {
    expect(outcome).toMatchObject({
      outcome: "ok",
      value: {
        pieces: expect.arrayContaining([
          { file: "./src/infrastructure/engines/walker/authored-class-or-this/class-keyword/class-syntax.ts", ruleSetRoot: ".", mechanism: "walker", symptom: "authored-class-or-this", check: "class-keyword" },
        ]),
      },
    });
  });

  it("finds every piece import inside the piece's reach", () => {
    expect(outcome).toMatchObject({ outcome: "ok", value: { refusals: [] } });
  });
});

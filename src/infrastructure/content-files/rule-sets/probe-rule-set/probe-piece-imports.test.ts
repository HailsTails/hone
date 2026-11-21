import { describe, expect, it, vi } from "vitest";
import { pieceImportFindings } from "../../import-boundaries/piece-import-rules.ts";
import type { PathPort } from "../../../node/path-port.ts";
import { requiredEntry } from "../../../../../tests/required-entry.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const sources = import.meta.glob(
  ["./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/*/*/**/*.ts", "!./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/*/*/**/*.test.ts"],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const typePackageTexts = import.meta.glob(["./src/infrastructure/engines/*/runner/piece-type-packages.json"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const JOINED_REPOSITORY_PATHS: Readonly<Record<string, string>> = {
  '["./src/infrastructure/engines/eslint/runner/piece-type-packages.json"]': "src/infrastructure/engines/eslint/runner/piece-type-packages.json",
  '[".","src","infrastructure","engines","audit","runner","piece-type-packages.json"]': "src/infrastructure/engines/audit/runner/piece-type-packages.json",
  '["./src/infrastructure/engines/audit/runner/piece-type-packages.json"]': "src/infrastructure/engines/audit/runner/piece-type-packages.json",
  '["./src/infrastructure/content-files/rule-sets/probe-rule-set","mechanisms","audit","PD-1"]': "src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1",
  '["./src/infrastructure/content-files/rule-sets/probe-rule-set","rules","PD-1"]': "src/infrastructure/content-files/rule-sets/probe-rule-set/rules/PD-1",
  '[".","src","infrastructure","engines","audit","runner"]': "src/infrastructure/engines/audit/runner",
  '[".","src","domain"]': "src/domain",
  '[".","src","application","ports"]': "src/application/ports",
  '[".","src","infrastructure","content-files"]': "src/infrastructure/content-files",
  '[".","src","infrastructure","discipline-exceptions-folder"]': "src/infrastructure/discipline-exceptions-folder",
  '["./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1","../../../../../../engines/audit/runner/pieces/walker-piece.ts"]':
    "src/infrastructure/engines/audit/runner/pieces/walker-piece.ts",
};

const REPOSITORY_DIRECTORIES: Readonly<Record<string, string>> = {
  "./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts": "./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1",
};

const TABLE_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: ({ segments }) => requiredEntry({ table: JOINED_REPOSITORY_PATHS, key: JSON.stringify(segments) }),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: ({ path }) => requiredEntry({ table: REPOSITORY_DIRECTORIES, key: path }),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const outcome = pieceImportFindings({
  path: TABLE_PATH,
  installRoot: ".",
  ruleSetRoots: ["./src/infrastructure/content-files/rule-sets/probe-rule-set"],
  sources,
  typePackageTexts,
});

describe("FR-8 piece imports over the probe rule set's own piece source, shipped with the probe so the check without it stays green", () => {
  it("finds the probe rule set's PD-1 audit piece among the pieces it checks", () => {
    expect(outcome).toMatchObject({
      outcome: "ok",
      value: {
        pieces: expect.arrayContaining([
          {
            file: "./src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts",
            ruleSetRoot: "./src/infrastructure/content-files/rule-sets/probe-rule-set",
            mechanism: "audit",
            discipline: "PD-1",
          },
        ]),
      },
    });
  });

  it("finds every probe piece import inside the piece's reach", () => {
    expect(outcome).toMatchObject({ outcome: "ok", value: { refusals: [] } });
  });
});

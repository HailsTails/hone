import { assert, describe, expect, it, vi } from "vitest";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import {
  type PieceLocation,
  pieceFilesOf,
  pieceImportFindings,
  pieceImportRefusals,
} from "./piece-import-rules.ts";

const requiredEntry = <Entry>(request: { readonly table: Readonly<Record<string, Entry>>; readonly key: string }): Entry => {
  const entry = request.table[request.key];
  assert(entry !== undefined, `the fake table holds no entry for ${request.key}`);
  return entry;
};

const INSTALL_ROOT = "packages/hone";
const PROBE_ROOT = "packages/hone/tests/probe-rule-set";

const PIECE_FOLDER = "packages/hone/src/infrastructure/engines/audit/CD-14";
const CLASS_SYNTAX_KEY = "../../src/infrastructure/engines/audit/CD-14/class-syntax.ts";
const HELPER_KEY = "../../src/infrastructure/engines/audit/CD-14/helper.ts";
const PROBE_KEY = "../../tests/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts";
const PROBE_FOLDER = "../../tests/probe-rule-set/mechanisms/audit/PD-1";
const TYPE_PACKAGES_KEY = "../../src/infrastructure/engines/audit/runner/piece-type-packages.json";

const JOINED_REPOSITORY_PATHS: Readonly<Record<string, string>> = {
  '["packages/hone","src","infrastructure","engines","audit","CD-14"]': PIECE_FOLDER,
  '["packages/hone","rules","CD-14"]': "packages/hone/rules/CD-14",
  '["packages/hone","src","infrastructure","engines","audit","runner"]': "packages/hone/src/infrastructure/engines/audit/runner",
  '["packages/hone","src","domain"]': "packages/hone/src/domain",
  '["packages/hone","src","application","ports"]': "packages/hone/src/application/ports",
  '["packages/hone","src","infrastructure","content-files"]': "packages/hone/src/infrastructure/content-files",
  '["packages/hone","src","infrastructure","discipline-exceptions-folder"]':
    "packages/hone/src/infrastructure/discipline-exceptions-folder",
  [`["${PIECE_FOLDER}","./nested/helper.ts"]`]: `${PIECE_FOLDER}/nested/helper.ts`,
  [`["${PIECE_FOLDER}","../runner/walker-piece.ts"]`]: "packages/hone/src/infrastructure/engines/audit/runner/walker-piece.ts",
  [`["${PIECE_FOLDER}","../../../../../src/domain/values/result.ts"]`]: "packages/hone/src/domain/values/result.ts",
  [`["${PIECE_FOLDER}","../../../../../rules/CD-14/discipline.json"]`]: "packages/hone/rules/CD-14/discipline.json",
  [`["${PIECE_FOLDER}","../../eslint/CD-14/cd14.ts"]`]: "packages/hone/src/infrastructure/engines/eslint/CD-14/cd14.ts",
  [`["${PIECE_FOLDER}","../CD-15/no-for-of.ts"]`]: "packages/hone/src/infrastructure/engines/audit/CD-15/no-for-of.ts",
  [`["${PIECE_FOLDER}","../../eslint/runner/eslint-instance.ts"]`]:
    "packages/hone/src/infrastructure/engines/eslint/runner/eslint-instance.ts",
  '["../..","src","infrastructure","engines","audit","runner","piece-type-packages.json"]': TYPE_PACKAGES_KEY,
  [`["${TYPE_PACKAGES_KEY}"]`]: TYPE_PACKAGES_KEY,
  '["../../tests/probe-rule-set","mechanisms","audit","PD-1"]': PROBE_FOLDER,
  '["../../tests/probe-rule-set","rules","PD-1"]': "../../tests/probe-rule-set/rules/PD-1",
  '["../..","src","infrastructure","engines","audit","runner"]': "../../src/infrastructure/engines/audit/runner",
  '["../..","src","domain"]': "../../src/domain",
  '["../..","src","application","ports"]': "../../src/application/ports",
  '["../..","src","infrastructure","content-files"]': "../../src/infrastructure/content-files",
  '["../..","src","infrastructure","discipline-exceptions-folder"]': "../../src/infrastructure/discipline-exceptions-folder",
  [`["${PROBE_FOLDER}","../../../../../src/infrastructure/engines/audit/runner/walker-piece.ts"]`]:
    "../../src/infrastructure/engines/audit/runner/walker-piece.ts",
};

const REPOSITORY_DIRECTORIES: Readonly<Record<string, string>> = {
  "packages/hone/src/infrastructure/engines/audit/CD-14/class-syntax.ts": PIECE_FOLDER,
  [PROBE_KEY]: PROBE_FOLDER,
};

const path: PathPort = {
  join: vi.fn<PathPort["join"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: ({ segments }) => requiredEntry({ table: JOINED_REPOSITORY_PATHS, key: JSON.stringify(segments) }),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: ({ path: filePath }) => requiredEntry({ table: REPOSITORY_DIRECTORIES, key: filePath }),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const WALKER_PIECE: PieceLocation = {
  file: "packages/hone/src/infrastructure/engines/audit/CD-14/class-syntax.ts",
  ruleSetRoot: INSTALL_ROOT,
  mechanism: "audit",
  discipline: disciplineIdOf("CD-14"),
};

const refusalsOf = (request: {
  readonly piece: PieceLocation;
  readonly source: string;
}) =>
  pieceImportRefusals({
    path,
    installRoot: INSTALL_ROOT,
    piece: request.piece,
    source: request.source,
    typePackages: ["typescript"],
  });

describe("pieceFilesOf", () => {
  it("lists a non-test TypeScript file in an install piece folder with its rule set, mechanism and discipline", () => {
    expect(
      pieceFilesOf({
        trackedPaths: [
          "packages/hone/src/infrastructure/engines/audit/CD-14/class-syntax.ts",
          "packages/hone/src/infrastructure/engines/audit/CD-14/class-syntax.test.ts",
          "packages/hone/src/infrastructure/engines/audit/CD-14/piece.json",
        ],
        ruleSetRoots: [INSTALL_ROOT, PROBE_ROOT],
        installRoot: INSTALL_ROOT,
      }),
    ).toEqual({ outcome: "ok", value: [WALKER_PIECE] });
  });

  it.each([
    "packages/hone/src/infrastructure/engines/protocol/checks/checks-runner.ts",
    "packages/hone/src/infrastructure/engines/audit/runner/runner.ts",
  ])("does not list %s, which is no piece's file", (file) => {
    expect(pieceFilesOf({ trackedPaths: [file], ruleSetRoots: [INSTALL_ROOT], installRoot: INSTALL_ROOT })).toEqual({ outcome: "ok", value: [] });
  });

  it("refuses a piece folder under a mechanism other than audit or eslint", () => {
    const file = "packages/hone/src/infrastructure/engines/oxlint/CD-14/class-syntax.ts";

    expect(pieceFilesOf({ trackedPaths: [file], ruleSetRoots: [INSTALL_ROOT], installRoot: INSTALL_ROOT })).toEqual({
      outcome: "failed",
      error: { kind: "unknown-mechanism", file, mechanism: "oxlint" },
    });
  });
});

describe("pieceImportRefusals allows", () => {
  it("a relative import inside the piece's own folder", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import { helper } from "./nested/helper.ts";\n' })).toEqual([]);
  });

  it("a relative import of the piece's own mechanism runner", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import type { WalkerPiece } from "../runner/walker-piece.ts";\n' }),
    ).toEqual([]);
  });

  it("a relative import of the domain", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import type { Result } from "../../../../../src/domain/values/result.ts";\n' }),
    ).toEqual([]);
  });

  it("a relative import of its own discipline's rule files", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'import discipline from "../../../../../rules/CD-14/discipline.json" with { type: "json" };\n',
      }),
    ).toEqual([]);
  });

  it("a type import of a package its runner lists", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import type { Node } from "typescript";\n' })).toEqual([]);
  });
});

describe("pieceImportRefusals refuses", () => {
  it("a relative import of another mechanism's piece for the same discipline", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import { rule } from "../../eslint/CD-14/cd14.ts";\n' })).toEqual([
      { specifier: "../../eslint/CD-14/cd14.ts", reason: "outside-piece-reach" },
    ]);
  });

  it("a relative import of another discipline's piece in the same mechanism", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import { check } from "../CD-15/no-for-of.ts";\n' })).toEqual([
      { specifier: "../CD-15/no-for-of.ts", reason: "outside-piece-reach" },
    ]);
  });

  it("a relative import of another mechanism's runner", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import { lintSourceCases } from "../../eslint/runner/eslint-instance.ts";\n' }),
    ).toEqual([{ specifier: "../../eslint/runner/eslint-instance.ts", reason: "outside-piece-reach" }]);
  });

  it("a dynamic import inside the piece's own folder", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'export const load = () => import("./nested/helper.ts");\n' }),
    ).toEqual([{ specifier: "./nested/helper.ts", reason: "dynamic-import" }]);
  });

  it("a value import of a package its runner lists", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import ts from "typescript";\n' })).toEqual([
      { specifier: "typescript", reason: "value-import-of-package" },
    ]);
  });

  it("a type import of a package its runner does not list", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import type { Program } from "acorn";\n' })).toEqual([
      { specifier: "acorn", reason: "package-not-listed" },
    ]);
  });
});

const SOURCES: Readonly<Record<string, string>> = {
  [CLASS_SYNTAX_KEY]: 'import type { Program } from "acorn";\n',
  [HELPER_KEY]: 'import type { Node } from "typescript";\n',
  [PROBE_KEY]: 'import type { WalkerPiece } from "../../../../../src/infrastructure/engines/audit/runner/walker-piece.ts";\n',
};

const findingsOver = (request: { readonly typePackageTexts: Readonly<Record<string, string>> }) =>
  pieceImportFindings({
    path,
    installRoot: "../..",
    ruleSetRoots: ["../..", "../../tests/probe-rule-set"],
    sources: SOURCES,
    typePackageTexts: request.typePackageTexts,
  });

describe("pieceImportFindings", () => {
  it("lists every piece in the sources and each refused import with its file", () => {
    expect(findingsOver({ typePackageTexts: { [TYPE_PACKAGES_KEY]: '["typescript"]' } })).toEqual({
      outcome: "ok",
      value: {
        pieces: [
          { file: CLASS_SYNTAX_KEY, ruleSetRoot: "../..", mechanism: "audit", discipline: "CD-14" },
          { file: HELPER_KEY, ruleSetRoot: "../..", mechanism: "audit", discipline: "CD-14" },
          { file: PROBE_KEY, ruleSetRoot: "../../tests/probe-rule-set", mechanism: "audit", discipline: "PD-1" },
        ],
        refusals: [{ file: CLASS_SYNTAX_KEY, specifier: "acorn", reason: "package-not-listed" }],
      },
    });
  });

  it("fails when a piece's runner has no piece type packages file", () => {
    expect(findingsOver({ typePackageTexts: {} })).toEqual({
      outcome: "failed",
      error: { kind: "type-packages-missing", path: TYPE_PACKAGES_KEY },
    });
  });
});

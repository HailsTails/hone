import { describe, expect, it, vi } from "vitest";

import { catalogueNameOf } from "../../../domain/language-layer/catalogue-name.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import {
  type PieceLocation,
  pieceFilesOf,
  pieceImportFindings,
  pieceImportRefusals,
} from "./piece-import-rules.ts";

const INSTALL_ROOT = "packages/hone";
const PROBE_ROOT = "packages/hone/tests/probe-rule-set";
const TEAM_ROOT = "tools/acme";
const TEAM_PIECE_FOLDER = "tools/acme/engines/walker/scratch-file/scratch-files";

const CLASS_SYNTAX_KEY = "../../src/infrastructure/engines/walker/CD-14/class-syntax.ts";
const HELPER_KEY = "../../src/infrastructure/engines/walker/CD-14/helper.ts";
const PROBE_KEY = "../../tests/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts";
const TYPE_PACKAGES_KEY = "../../src/infrastructure/engines/walker/runner/piece-type-packages.json";

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const WALKER_PIECE: PieceLocation = {
  file: "packages/hone/src/infrastructure/engines/walker/CD-14/class-syntax.ts",
  ruleSetRoot: INSTALL_ROOT,
  mechanism: "walker",
  discipline: disciplineIdOf("CD-14"),
};

const TEAM_PIECE: PieceLocation = {
  file: `${TEAM_PIECE_FOLDER}/scratch-files.ts`,
  ruleSetRoot: TEAM_ROOT,
  mechanism: "walker",
  symptom: catalogueNameOf("scratch-file"),
  check: catalogueNameOf("scratch-files"),
};

const refusalsOf = (request: { readonly piece: PieceLocation; readonly source: string }) =>
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
          "packages/hone/src/infrastructure/engines/walker/CD-14/class-syntax.ts",
          "packages/hone/src/infrastructure/engines/walker/CD-14/class-syntax.test.ts",
          "packages/hone/src/infrastructure/engines/walker/CD-14/piece.json",
        ],
        ruleSetRoots: [INSTALL_ROOT, PROBE_ROOT],
        installRoot: INSTALL_ROOT,
      }),
    ).toEqual({ outcome: "ok", value: [WALKER_PIECE] });
  });

  it("lists a team's piece file under its engines folder with its engine, symptom and check", () => {
    expect(
      pieceFilesOf({
        trackedPaths: [`${TEAM_PIECE_FOLDER}/scratch-files.ts`],
        ruleSetRoots: [INSTALL_ROOT, TEAM_ROOT],
        installRoot: INSTALL_ROOT,
      }),
    ).toEqual({ outcome: "ok", value: [TEAM_PIECE] });
  });

  it("refuses a team's named piece left in the version 1 mechanisms folder, which holds discipline pieces only", () => {
    const file = "tools/acme/mechanisms/walker/scratch-file/scratch-files/scratch-files.ts";

    expect(
      pieceFilesOf({ trackedPaths: [file], ruleSetRoots: [TEAM_ROOT], installRoot: INSTALL_ROOT }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "not-a-discipline", file, folder: "scratch-file" },
    });
  });

  it.each([
    {
      file: "tools/acme/engines/walker/Scratch_File/scratch-files/scratch-files.ts",
      folder: "walker/Scratch_File/scratch-files",
    },
    {
      file: "tools/acme/engines/walker/scratch-file/scratch-files.ts",
      folder: "walker/scratch-file",
    },
  ])(
    "refuses $file under a team's engines folder, which sits in no symptom and check folder",
    ({ file, folder }) => {
      expect(
        pieceFilesOf({
          trackedPaths: [file],
          ruleSetRoots: [TEAM_ROOT],
          installRoot: INSTALL_ROOT,
        }),
      ).toEqual({ outcome: "failed", error: { kind: "not-a-named-piece", file, folder } });
    },
  );

  it("refuses a file under a team's engines folder for an engine Hone does not have", () => {
    const file = "tools/acme/engines/biome/scratch-file/scratch-files/scratch-files.ts";

    expect(
      pieceFilesOf({ trackedPaths: [file], ruleSetRoots: [TEAM_ROOT], installRoot: INSTALL_ROOT }),
    ).toEqual({ outcome: "failed", error: { kind: "unknown-engine", file, engine: "biome" } });
  });

  it.each([
    "packages/hone/src/infrastructure/engines/protocol/checks/checks-runner.ts",
    "packages/hone/src/infrastructure/engines/walker/runner/runner.ts",
  ])("does not list %s, which is no piece's file", (file) => {
    expect(
      pieceFilesOf({
        trackedPaths: [file],
        ruleSetRoots: [INSTALL_ROOT],
        installRoot: INSTALL_ROOT,
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });

  it.each([
    {
      file: "packages/hone/src/infrastructure/engines/walker/not-a-discipline/class-syntax.ts",
      folder: "not-a-discipline",
    },
    {
      file: "packages/hone/src/infrastructure/engines/walker/cd-14/class-syntax.ts",
      folder: "cd-14",
    },
  ])(
    "refuses the folder $folder under the audit mechanism, which is no discipline id",
    ({ file, folder }) => {
      expect(
        pieceFilesOf({
          trackedPaths: [file],
          ruleSetRoots: [INSTALL_ROOT],
          installRoot: INSTALL_ROOT,
        }),
      ).toEqual({
        outcome: "failed",
        error: { kind: "not-a-discipline", file, folder },
      });
    },
  );

  it("refuses a piece folder under an unknown mechanism", () => {
    const file = "packages/hone/src/infrastructure/engines/biome/CD-14/class-syntax.ts";

    expect(
      pieceFilesOf({
        trackedPaths: [file],
        ruleSetRoots: [INSTALL_ROOT],
        installRoot: INSTALL_ROOT,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-mechanism", file, mechanism: "biome" },
    });
  });
});

describe("pieceImportRefusals allows", () => {
  it("a relative import inside the piece's own folder", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import { helper } from "./nested/helper.ts";\n' }),
    ).toEqual([]);
  });

  it("a relative import of the piece's own mechanism runner", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'import type { WalkerPiece } from "../runner/walker-piece.ts";\n',
      }),
    ).toEqual([]);
  });

  it("a relative import of the domain", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'import type { Result } from "../../../../../src/domain/values/result.ts";\n',
      }),
    ).toEqual([]);
  });

  it("a relative import of its own discipline's rule files", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source:
          'import discipline from "../../../../../rules/CD-14/discipline.json" with { type: "json" };\n',
      }),
    ).toEqual([]);
  });

  it("a type import of a package its runner lists", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import type { Node } from "typescript";\n' }),
    ).toEqual([]);
  });
});

describe("pieceImportRefusals refuses", () => {
  it("a relative import of another mechanism's piece for the same discipline", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'import { rule } from "../../eslint/CD-14/cd14.ts";\n',
      }),
    ).toEqual([{ specifier: "../../eslint/CD-14/cd14.ts", reason: "outside-piece-reach" }]);
  });

  it("a relative import of another discipline's piece in the same mechanism", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'import { check } from "../CD-15/no-for-of.ts";\n',
      }),
    ).toEqual([{ specifier: "../CD-15/no-for-of.ts", reason: "outside-piece-reach" }]);
  });

  it("a relative import of another mechanism's runner", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'import { lintSourceCases } from "../../eslint/runner/eslint-instance.ts";\n',
      }),
    ).toEqual([
      { specifier: "../../eslint/runner/eslint-instance.ts", reason: "outside-piece-reach" },
    ]);
  });

  it("a dynamic import inside the piece's own folder", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'export const load = () => import("./nested/helper.ts");\n',
      }),
    ).toEqual([{ specifier: "./nested/helper.ts", reason: "dynamic-import" }]);
  });

  it("a value import of a package its runner lists", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import ts from "typescript";\n' })).toEqual([
      { specifier: "typescript", reason: "value-import-of-package" },
    ]);
  });

  it("a named piece's relative import of its symptom's page, which is no part of its reach", () => {
    expect(
      refusalsOf({
        piece: TEAM_PIECE,
        source:
          'import page from "../../../../rules/markdown/symptoms/scratch-file.md" with { type: "text" };\n',
      }),
    ).toEqual([
      {
        specifier: "../../../../rules/markdown/symptoms/scratch-file.md",
        reason: "outside-piece-reach",
      },
    ]);
  });

  it("a type import of a package its runner does not list", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import type { Program } from "acorn";\n' }),
    ).toEqual([{ specifier: "acorn", reason: "package-not-listed" }]);
  });
});

const SOURCES: Readonly<Record<string, string>> = {
  [CLASS_SYNTAX_KEY]: 'import type { Program } from "acorn";\n',
  [HELPER_KEY]: 'import type { Node } from "typescript";\n',
  [PROBE_KEY]:
    'import type { WalkerPiece } from "../../../../../src/infrastructure/engines/walker/runner/walker-piece.ts";\n',
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
          {
            file: CLASS_SYNTAX_KEY,
            ruleSetRoot: "../..",
            mechanism: "walker",
            discipline: "CD-14",
          },
          { file: HELPER_KEY, ruleSetRoot: "../..", mechanism: "walker", discipline: "CD-14" },
          {
            file: PROBE_KEY,
            ruleSetRoot: "../../tests/probe-rule-set",
            mechanism: "walker",
            discipline: "PD-1",
          },
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

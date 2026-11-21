import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import type { PathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { editionSchema } from "../edition.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import {
  clauseIdSchema,
  disciplineIdSchema,
  mechanismIdSchema,
} from "../../hone-config-file/identifiers.ts";
import {
  type DisciplineFile,
  parsedJson,
  readDisciplineFile,
  readPieceFile,
} from "./rule-set-reader.ts";

const ROOT = absolutePathSchema.parse("/install");
const INSTALL_ROOT = absolutePathSchema.parse("/running-install");
const CD_14 = disciplineIdSchema.parse("CD-14");
const WALKER = mechanismIdSchema.parse("audit");
const DISCIPLINE_PATH = "/install/rules/CD-14/discipline.json";
const PIECE_PATH = "/install/mechanisms/audit/CD-14/piece.json";

const fileTextReading = (request: { readonly text: string }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
  exists: vi.fn(),
  write: vi.fn(),
});

const unreadableFileText = (): FileTextPort => ({
  read: vi
    .fn<FileTextPort["read"]>()
    .mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } }),
  exists: vi.fn(),
  write: vi.fn(),
});

const pathJoiningTo = (request: { readonly joined: string }): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(request.joined),
  relative: vi.fn(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn(),
  fromFileUrl: vi.fn(),
});

const FLAG_CASE = {
  name: "class declaration",
  fileName: "src/a.ts",
  source: "class A {}\n",
  expectedLines: [1],
};

const ALLOW_CASE = {
  name: "arrow function",
  fileName: "src/b.ts",
  source: "const b = () => 1;\n",
  expectedLines: [],
};

const CLASS_SYNTAX = {
  kind: "mechanical",
  id: "class-syntax",
  summary: "no class syntax",
  mechanisms: ["audit", "eslint"],
  anchor: { kind: "keyword", keyword: "class" },
  exceptions: "allowed",
  cases: { flag: [FLAG_CASE], allow: [ALLOW_CASE] },
};

const LIBRARY_CONSTRUCTION = {
  kind: "judgement",
  id: "library-construction",
  summary: "wrap libraries in factories",
  enforcedBy: "review",
};

const DISCIPLINE = {
  version: 1,
  id: "CD-14",
  clauses: [CLASS_SYNTAX, LIBRARY_CONSTRUCTION],
};

const PIECE = {
  version: 1,
  discipline: "CD-14",
  mechanism: "audit",
  clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
};

const readDiscipline = (file: unknown) =>
  readDisciplineFile({
    fileText: fileTextReading({ text: JSON.stringify(file) }),
    path: pathJoiningTo({ joined: DISCIPLINE_PATH }),
    ruleSetRoot: ROOT,
    discipline: CD_14,
  });

const LOADED_DISCIPLINE: DisciplineFile = {
  version: 1,
  id: CD_14,
  clauses: [
    {
      kind: "mechanical",
      id: clauseIdSchema.parse("class-syntax"),
      summary: CLASS_SYNTAX.summary,
      mechanisms: [WALKER, mechanismIdSchema.parse("eslint")],
      anchor: { kind: "keyword", keyword: "class" },
      exceptions: "allowed",
      cases: { flag: [], allow: [] },
    },
  ],
};

const SECOND_EDITION_DISCIPLINE: DisciplineFile = {
  ...LOADED_DISCIPLINE,
  clauses: [
    {
      kind: "mechanical",
      id: clauseIdSchema.parse("class-syntax"),
      summary: CLASS_SYNTAX.summary,
      mechanisms: [WALKER],
      anchor: { kind: "keyword", keyword: "class" },
      exceptions: "allowed",
      cases: {
        flag: [{ name: FLAG_CASE.name, fileName: repoPathSchema.parse(FLAG_CASE.fileName), source: FLAG_CASE.source, expectedLines: [1], edition: editionSchema.parse("2") }],
        allow: [],
      },
    },
  ],
};

const FIRST_EDITION_ONLY = { declared: ["1"], default: "1", latest: "1" };

const readPiece = (file: unknown) =>
  readPieceFile({
    fileText: fileTextReading({ text: JSON.stringify(file) }),
    path: pathJoiningTo({ joined: PIECE_PATH }),
    ruleSetRoot: ROOT,
    installRoot: INSTALL_ROOT,
    mechanism: WALKER,
    discipline: LOADED_DISCIPLINE,
  });

describe("readDisciplineFile", () => {
  it("reads <ruleSetRoot>/rules/<discipline>/discipline.json into a discipline file", () => {
    expect(readDiscipline(DISCIPLINE)).toEqual({ outcome: "ok", value: DISCIPLINE });
  });

  it("reads a clause that names no exceptions policy as allowing exceptions", () => {
    const { exceptions: _exceptions, ...unstated } = CLASS_SYNTAX;

    expect(readDiscipline({ ...DISCIPLINE, clauses: [unstated, LIBRARY_CONSTRUCTION] })).toEqual({
      outcome: "ok",
      value: DISCIPLINE,
    });
  });

  it("reads a clause that refuses exceptions", () => {
    const refusing = { ...DISCIPLINE, clauses: [{ ...CLASS_SYNTAX, exceptions: "refused" }, LIBRARY_CONSTRUCTION] };

    expect(readDiscipline(refusing)).toEqual({ outcome: "ok", value: refusing });
  });

  it("allows a case fileName ending .d.ts", () => {
    const file = {
      ...DISCIPLINE,
      clauses: [
        { ...CLASS_SYNTAX, cases: { flag: [{ ...FLAG_CASE, fileName: "types/ambient.d.ts" }], allow: [ALLOW_CASE] } },
      ],
    };

    expect(readDiscipline(file)).toEqual({ outcome: "ok", value: file });
  });

  it("reads the joined discipline path", () => {
    const fileText = fileTextReading({ text: JSON.stringify(DISCIPLINE) });

    readDisciplineFile({
      fileText,
      path: pathJoiningTo({ joined: DISCIPLINE_PATH }),
      ruleSetRoot: ROOT,
      discipline: CD_14,
    });

    expect(fileText.read).toHaveBeenCalledWith({ path: "/install/rules/CD-14/discipline.json" });
  });

  it("is file-unreadable with the path when the file cannot be read", () => {
    const disciplineRead = readDisciplineFile({
      fileText: unreadableFileText(),
      path: pathJoiningTo({ joined: DISCIPLINE_PATH }),
      ruleSetRoot: ROOT,
      discipline: CD_14,
    });

    expect(disciplineRead).toMatchObject({
      outcome: "failed",
      error: { kind: "file-unreadable", path: DISCIPLINE_PATH },
    });
  });

  it("is file-malformed with the path when the text is not JSON", () => {
    const disciplineRead = readDisciplineFile({
      fileText: fileTextReading({ text: "{ not json" }),
      path: pathJoiningTo({ joined: DISCIPLINE_PATH }),
      ruleSetRoot: ROOT,
      discipline: CD_14,
    });

    expect(disciplineRead).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: DISCIPLINE_PATH },
    });
  });

  it("is file-malformed when the shape does not match", () => {
    expect(readDiscipline({ version: 1, id: "CD-14" })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: DISCIPLINE_PATH },
    });
  });

  it("is unsupported-version with the found value for a version other than 1", () => {
    expect(readDiscipline({ ...DISCIPLINE, version: 2 })).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: DISCIPLINE_PATH, found: 2 },
    });
  });

  it("refuses an id that differs from its folder name as rule-set-invalid", () => {
    expect(readDiscipline({ ...DISCIPLINE, id: "CD-15" })).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses duplicate clause ids as rule-set-invalid", () => {
    expect(
      readDiscipline({ ...DISCIPLINE, clauses: [CLASS_SYNTAX, CLASS_SYNTAX] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a mechanical clause listing not-adopted as a mechanism, naming the word as reserved", () => {
    expect(
      readDiscipline({ ...DISCIPLINE, clauses: [{ ...CLASS_SYNTAX, mechanisms: ["audit", "not-adopted"] }] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH, detail: expect.stringContaining("reserved for a clause a repository does not adopt") },
    });
  });

  it("refuses a mechanical clause with no mechanism as rule-set-invalid", () => {
    expect(
      readDiscipline({ ...DISCIPLINE, clauses: [{ ...CLASS_SYNTAX, mechanisms: [] }] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a mechanical clause with no flag case as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [{ ...CLASS_SYNTAX, cases: { flag: [], allow: [ALLOW_CASE] } }],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a mechanical clause with no allow case as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [{ ...CLASS_SYNTAX, cases: { flag: [FLAG_CASE], allow: [] } }],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses an allow case with expected lines as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [
          { ...CLASS_SYNTAX, cases: { flag: [FLAG_CASE], allow: [{ ...ALLOW_CASE, expectedLines: [1] }] } },
        ],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a flag case with no expected lines as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [
          { ...CLASS_SYNTAX, cases: { flag: [{ ...FLAG_CASE, expectedLines: [] }], allow: [ALLOW_CASE] } },
        ],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("reads a case that names the edition it runs under", () => {
    const file = { ...DISCIPLINE, clauses: [{ ...CLASS_SYNTAX, cases: { flag: [{ ...FLAG_CASE, edition: "2" }], allow: [ALLOW_CASE] } }] };

    expect(readDiscipline(file)).toEqual({ outcome: "ok", value: file });
  });

  it("refuses a case edition that is not a whole number as file-malformed", () => {
    expect(
      readDiscipline({ ...DISCIPLINE, clauses: [{ ...CLASS_SYNTAX, cases: { flag: [{ ...FLAG_CASE, edition: "latest" }], allow: [ALLOW_CASE] } }] }),
    ).toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: DISCIPLINE_PATH } });
  });

  it("refuses a case fileName that is not a RepoPath as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [
          { ...CLASS_SYNTAX, cases: { flag: [{ ...FLAG_CASE, fileName: "../a.ts" }], allow: [ALLOW_CASE] } },
        ],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });
});

describe("readPieceFile", () => {
  it("reads <ruleSetRoot>/mechanisms/<mechanism>/<discipline>/piece.json into a piece file", () => {
    expect(readPiece(PIECE)).toEqual({
      outcome: "ok",
      value: {
        ...PIECE,
        clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" }, clauseSettings: {}, editions: FIRST_EDITION_ONLY }],
      },
    });
  });

  it("reads declared editions with the first as the default and the last as the latest", () => {
    const clause = { clause: "class-syntax", settings: { module: "class-syntax.ts" }, editions: ["1", "2"] };

    expect(readPiece({ ...PIECE, clauses: [clause] })).toEqual({
      outcome: "ok",
      value: { ...PIECE, clauses: [{ ...clause, clauseSettings: {}, editions: { declared: ["1", "2"], default: "1", latest: "2" } }] },
    });
  });

  it.each([
    { name: "editions out of order", editions: ["2", "1"], kind: "rule-set-invalid" },
    { name: "an edition that is not a whole number", editions: ["1", "two"], kind: "file-malformed" },
    { name: "no editions", editions: [], kind: "file-malformed" },
  ])("refuses $name as $kind", ({ editions, kind }) => {
    expect(
      readPiece({ ...PIECE, clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" }, editions }] }),
    ).toMatchObject({ outcome: "failed", error: { kind } });
  });

  it("refuses a clause setting named edition as reserved for the clause's editions", () => {
    expect(
      readPiece({
        ...PIECE,
        clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" }, clauseSettings: { edition: { default: "1" } } }],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", detail: expect.stringContaining("edition is reserved for the clause's editions") },
    });
  });

  it("refuses a case that runs under an edition the piece does not declare", () => {
    expect(
      readPieceFile({
        fileText: fileTextReading({ text: JSON.stringify(PIECE) }),
        path: pathJoiningTo({ joined: PIECE_PATH }),
        ruleSetRoot: ROOT,
        installRoot: INSTALL_ROOT,
        mechanism: WALKER,
        discipline: SECOND_EDITION_DISCIPLINE,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        path: PIECE_PATH,
        detail: "case class declaration of clause class-syntax runs under edition 2, which this piece does not declare; it declares 1",
      },
    });
  });

  it("refuses a piece declaring not-adopted as its mechanism, naming the word as reserved", () => {
    expect(readPiece({ ...PIECE, mechanism: "not-adopted" })).toMatchObject({
      outcome: "failed",
      error: { detail: expect.stringContaining("reserved for a clause a repository does not adopt") },
    });
  });

  it("keeps each entry's settings uninterpreted", () => {
    const clause = { clause: "class-syntax", settings: { anything: [1, "two"] } };

    expect(readPiece({ ...PIECE, clauses: [clause] })).toEqual({
      outcome: "ok",
      value: { ...PIECE, clauses: [{ ...clause, clauseSettings: {}, editions: FIRST_EDITION_ONLY }] },
    });
  });

  it("reads each declared clause setting beside the mechanism settings", () => {
    const clauseSettings = {
      convention: { default: "camelCase", choices: ["camelCase", "snake_case"] },
      confinedPackages: { default: [] },
    };
    const clause = { clause: "class-syntax", settings: { module: "class-syntax.ts" }, clauseSettings };

    expect(readPiece({ ...PIECE, clauses: [clause] })).toEqual({
      outcome: "ok",
      value: { ...PIECE, clauses: [{ ...clause, editions: FIRST_EDITION_ONLY }] },
    });
  });

  it.each([
    { name: "a declaration with no default", clauseSettings: { convention: { choices: ["camelCase"] } }, kind: "file-malformed" },
    { name: "a declaration with an unknown field", clauseSettings: { convention: { default: "camelCase", values: [] } }, kind: "file-malformed" },
    { name: "empty choices", clauseSettings: { convention: { default: "camelCase", choices: [] } }, kind: "file-malformed" },
    { name: "an empty key", clauseSettings: { "": { default: [] } }, kind: "file-malformed" },
    { name: "a choice of another JSON kind", clauseSettings: { convention: { default: "camelCase", choices: ["camelCase", 1] } }, kind: "rule-set-invalid" },
    { name: "a default outside its choices", clauseSettings: { convention: { default: "camelCase", choices: ["snake_case"] } }, kind: "rule-set-invalid" },
  ])("refuses $name as $kind", ({ clauseSettings, kind }) => {
    expect(
      readPiece({ ...PIECE, clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" }, clauseSettings }] }),
    ).toMatchObject({ outcome: "failed", error: { kind } });
  });

  it("names a choice's required kind with its article", () => {
    expect(
      readPiece({
        ...PIECE,
        clauses: [
          {
            clause: "class-syntax",
            settings: { module: "class-syntax.ts" },
            clauseSettings: { allowed: { default: [], choices: [[], "none"] } },
          },
        ],
      }),
    ).toMatchObject({ outcome: "failed", error: { detail: expect.stringContaining("every choice must be an array, as the default is") } });
  });

  it("reads the joined piece path", () => {
    const fileText = fileTextReading({ text: JSON.stringify(PIECE) });

    readPieceFile({
      fileText,
      path: pathJoiningTo({ joined: PIECE_PATH }),
      ruleSetRoot: ROOT,
      installRoot: INSTALL_ROOT,
      mechanism: WALKER,
      discipline: LOADED_DISCIPLINE,
    });

    expect(fileText.read).toHaveBeenCalledWith({
      path: "/install/mechanisms/audit/CD-14/piece.json",
    });
  });

  it("is file-unreadable with the path when the piece cannot be read", () => {
    const pieceRead = readPieceFile({
      fileText: unreadableFileText(),
      path: pathJoiningTo({ joined: PIECE_PATH }),
      ruleSetRoot: ROOT,
      installRoot: INSTALL_ROOT,
      mechanism: WALKER,
      discipline: LOADED_DISCIPLINE,
    });

    expect(pieceRead).toMatchObject({
      outcome: "failed",
      error: { kind: "file-unreadable", path: PIECE_PATH },
    });
  });

  it("is file-malformed when the shape does not match", () => {
    expect(readPiece({ version: 1, discipline: "CD-14" })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: PIECE_PATH },
    });
  });

  it("is unsupported-version with the found value for a version other than 1", () => {
    expect(readPiece({ ...PIECE, version: 3 })).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: PIECE_PATH, found: 3 },
    });
  });

  it("refuses a discipline that differs from its folder name as rule-set-invalid", () => {
    expect(readPiece({ ...PIECE, discipline: "CD-15" })).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: PIECE_PATH },
    });
  });

  it("refuses a mechanism that differs from its folder name as rule-set-invalid", () => {
    expect(readPiece({ ...PIECE, mechanism: "eslint" })).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: PIECE_PATH },
    });
  });

  it("refuses a clause id not in the discipline as rule-set-invalid", () => {
    expect(
      readPiece({ ...PIECE, clauses: [{ clause: "no-such-clause", settings: {} }] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: PIECE_PATH },
    });
  });

  it("refuses duplicate clause entries as rule-set-invalid", () => {
    expect(
      readPiece({ ...PIECE, clauses: [PIECE.clauses[0], PIECE.clauses[0]] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: PIECE_PATH },
    });
  });
});

describe("parsedJson", () => {
  it("returns the parsed value of JSON text", () => {
    expect(parsedJson({ text: `{ "scripts": { "lint": "eslint ." } }` })).toEqual({
      outcome: "ok",
      value: { scripts: { lint: "eslint ." } },
    });
  });

  it("is failed with the parser's message when the text is not JSON", () => {
    expect(parsedJson({ text: `{ "scripts": ` })).toEqual({
      outcome: "failed",
      error: expect.stringMatching(/.+/),
    });
  });
});

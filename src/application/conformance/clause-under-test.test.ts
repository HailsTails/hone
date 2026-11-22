import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { boundClauseOf, clauseUnderTestOf, repoPathOf, type RuleSetReading } from "./clause-under-test.ts";
import { createRuleSetFileReader } from "../../infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { loadFailureDetail } from "../../infrastructure/printed-report/load-failures/load-failure-text.ts";

const ruleSetReadingOf = (request: { readonly fileText: FileTextPort; readonly path: PathPort }): Pick<RuleSetReading, "ruleSetFiles" | "loadFailureDetail" | "path"> => ({
  ruleSetFiles: createRuleSetFileReader(request),
  loadFailureDetail,
  path: request.path,
});

const AUDIT = mechanismIdSchema.parse("audit");

const RULE_SET_ROOT = absolutePathSchema.parse("/repo/tools/disciplines/acme");
const INSTALL_ROOT = absolutePathSchema.parse("/repo/node_modules/hone");
const DISCIPLINE_PATH = "/repo/tools/disciplines/acme/rules/ACME-2/discipline.json";
const PIECE_PATH = "/repo/tools/disciplines/acme/mechanisms/audit/ACME-2/piece.json";
const PIECE_ROOT = "/repo/tools/disciplines/acme/mechanisms/audit/ACME-2";

const FLAG_CASE = { name: "scratch file", fileName: "src/draft.scratch.ts", source: "export const draft = 1;\n", expectedLines: [1] };
const ALLOW_CASE = { name: "ordinary file", fileName: "src/kept.ts", source: "export const kept = 1;\n", expectedLines: [] };

const DISCIPLINE_TEXT = JSON.stringify({
  version: 1,
  id: "ACME-2",
  clauses: [
    {
      kind: "mechanical",
      id: "scratch-files",
      summary: "no scratch file is committed",
      mechanisms: ["audit"],
      anchor: { kind: "file" },
      cases: { flag: [FLAG_CASE], allow: [ALLOW_CASE] },
    },
    { kind: "judgement", id: "named-intent", summary: "Names say what they hold.", enforcedBy: "review" },
  ],
});

const PIECE_TEXT = JSON.stringify({
  version: 1,
  discipline: "ACME-2",
  mechanism: "audit",
  clauses: [
    {
      clause: "scratch-files",
      settings: { module: "scratch-files.ts" },
      clauseSettings: { marker: { default: ".scratch." } },
    },
  ],
});

const EDITIONED_DISCIPLINE_TEXT = JSON.stringify({
  version: 1,
  id: "ACME-2",
  clauses: [
    {
      kind: "mechanical",
      id: "scratch-files",
      summary: "no scratch file is committed",
      mechanisms: ["audit"],
      anchor: { kind: "file" },
      cases: { flag: [{ ...FLAG_CASE, edition: "2" }], allow: [ALLOW_CASE] },
    },
  ],
});

const EDITIONED_PIECE_TEXT = JSON.stringify({
  version: 1,
  discipline: "ACME-2",
  mechanism: "audit",
  clauses: [
    {
      clause: "scratch-files",
      settings: { module: "scratch-files.ts" },
      clauseSettings: { marker: { default: ".scratch." } },
      editions: ["1", "2"],
    },
  ],
});

const ESLINT_ONLY_DISCIPLINE_TEXT = JSON.stringify({
  version: 1,
  id: "ACME-2",
  clauses: [
    {
      kind: "mechanical",
      id: "scratch-files",
      summary: "no scratch file is committed",
      mechanisms: ["eslint"],
      anchor: { kind: "file" },
      cases: { flag: [FLAG_CASE], allow: [ALLOW_CASE] },
    },
  ],
});

const EMPTY_PIECE_TEXT = JSON.stringify({ version: 1, discipline: "ACME-2", mechanism: "audit", clauses: [] });

const fileTextReading =(request: { readonly discipline: string; readonly piece: string }): FileTextPort => ({
  read: vi
    .fn<FileTextPort["read"]>()
    .mockReturnValueOnce({ outcome: "ok", value: request.discipline })
    .mockReturnValueOnce({ outcome: "ok", value: request.piece }),
  exists: vi.fn(),
  write: vi.fn(),
});

const pathJoining = (): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValueOnce(DISCIPLINE_PATH).mockReturnValueOnce(PIECE_PATH).mockReturnValueOnce(PIECE_ROOT),
  joinRepository: vi.fn(),
  relative: vi.fn(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({ outcome: "ok", value: RULE_SET_ROOT }),
  fromFileUrl: vi.fn(),
});

const ACME_PATH = pathJoining();

const ACME_TEXT = fileTextReading({ discipline: DISCIPLINE_TEXT, piece: PIECE_TEXT });

const SCRATCH_FILES = clauseAddressSchema.parse("acme/ACME-2#scratch-files");

const BOUND_CLAUSE = {
  address: SCRATCH_FILES,
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  settings: { module: "scratch-files.ts" },
  clauseSettings: { marker: ".scratch." },
  edition: "1",
};

describe("boundClauseOf", () => {
  it("binds the clause as hone check binds it, with its piece settings, its default clause settings and its cases", () => {
    expect(
      boundClauseOf({
        ...ruleSetReadingOf({ fileText: fileTextReading({ discipline: DISCIPLINE_TEXT, piece: PIECE_TEXT }), path: pathJoining() }),
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        clause: BOUND_CLAUSE,
        cases: [
          { ...FLAG_CASE, fileName: repoPathSchema.parse(FLAG_CASE.fileName) },
          { ...ALLOW_CASE, fileName: repoPathSchema.parse(ALLOW_CASE.fileName) },
        ],
      },
    });
  });

  it("refuses text that is not a clause address", () => {
    expect(boundClauseOf({ ...ruleSetReadingOf({ fileText: ACME_TEXT, path: ACME_PATH }), mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT, clause: "ACME-2" })).toEqual({
      outcome: "failed",
      error: { kind: "address-invalid", detail: "ACME-2" },
    });
  });

  it("refuses a judgement clause, which has no cases to run", () => {
    expect(
      boundClauseOf({
        ...ruleSetReadingOf({ fileText: fileTextReading({ discipline: DISCIPLINE_TEXT, piece: PIECE_TEXT }), path: pathJoining() }),
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#named-intent",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "clause-not-mechanical", detail: "acme/ACME-2#named-intent" } });
  });

  it("names the file it could not read when the discipline is missing", () => {
    expect(
      boundClauseOf({
        ...ruleSetReadingOf({
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" } }),
            exists: vi.fn(),
            write: vi.fn(),
          },
          path: pathJoining(),
        }),
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-unloadable", detail: `file-unreadable ${DISCIPLINE_PATH} ENOENT` } });
  });

  it("refuses a clause the audit mechanism may not check, as hone check does", () => {
    expect(
      boundClauseOf({
        ...ruleSetReadingOf({ fileText: fileTextReading({ discipline: ESLINT_ONLY_DISCIPLINE_TEXT, piece: PIECE_TEXT }), path: pathJoining() }),
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-unloadable", detail: "mechanism-not-allowed acme/ACME-2#scratch-files audit" } });
  });

  it("refuses a clause its audit piece does not list, as hone check does", () => {
    expect(
      boundClauseOf({
        ...ruleSetReadingOf({ fileText: fileTextReading({ discipline: DISCIPLINE_TEXT, piece: EMPTY_PIECE_TEXT }), path: pathJoining() }),
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-unloadable", detail: "piece-missing acme/ACME-2#scratch-files audit" } });
  });

  it("refuses a rule set root that does not resolve", () => {
    expect(
      boundClauseOf({
        ...ruleSetReadingOf({ fileText: ACME_TEXT, path: { ...ACME_PATH, resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({ outcome: "failed", error: { kind: "working-directory-unusable", path: "acme" } }) } }),
        mechanism: AUDIT, ruleSetRoot: "acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-unloadable", detail: "acme does not resolve: working-directory-unusable" } });
  });
});

describe("clauseUnderTestOf", () => {
  it("gives the bound clause and each case's name, file and source", () => {
    expect(
      clauseUnderTestOf({
        ...ruleSetReadingOf({ fileText: fileTextReading({ discipline: DISCIPLINE_TEXT, piece: PIECE_TEXT }), path: pathJoining() }),
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        clause: BOUND_CLAUSE,
        cases: [
          { name: "scratch file", file: repoPathSchema.parse("src/draft.scratch.ts"), source: FLAG_CASE.source, edition: "1" },
          { name: "ordinary file", file: repoPathSchema.parse("src/kept.ts"), source: ALLOW_CASE.source, edition: "1" },
        ],
      },
    });
  });

  it("gives each case the edition it runs under, the piece's default when it names none", () => {
    expect(
      clauseUnderTestOf({
        ...ruleSetReadingOf({ fileText: fileTextReading({ discipline: EDITIONED_DISCIPLINE_TEXT, piece: EDITIONED_PIECE_TEXT }), path: pathJoining() }),
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { clause: { edition: "1" }, cases: [{ name: "scratch file", edition: "2" }, { name: "ordinary file", edition: "1" }] },
    });
  });

  it("passes a setup failure through", () => {
    expect(clauseUnderTestOf({ ...ruleSetReadingOf({ fileText: ACME_TEXT, path: ACME_PATH }), mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT, clause: "#" })).toEqual({
      outcome: "failed",
      error: { kind: "address-invalid", detail: "#" },
    });
  });
});

describe("repoPathOf", () => {
  it("gives a repository path for a relative path inside the repository", () => {
    expect(repoPathOf({ file: "apps/storefront/package.json" })).toEqual({
      outcome: "ok",
      value: repoPathSchema.parse("apps/storefront/package.json"),
    });
  });

  it("refuses a path that leaves the repository", () => {
    expect(repoPathOf({ file: "../outside.ts" })).toEqual({
      outcome: "failed",
      error: { kind: "file-invalid", detail: "../outside.ts" },
    });
  });
});

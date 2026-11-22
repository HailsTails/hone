import { describe, expect, it, vi } from "vitest";
import type { PathPort } from "../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { RuleSetFiles } from "../ports/rule-set/rule-set-files.ts";
import type { DisciplineFile, PieceFile } from "../../domain/rule-set/rule-set-types.ts";
import { boundClauseOf, clauseUnderTestOf, repoPathOf } from "./clause-under-test.ts";
import { repoPathOf as staticRepoPathOf } from "../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";

const AUDIT = "walker" as const;
const ESLINT = "eslint" as const;
const ACME_2 = disciplineIdOf("ACME-2");
const SCRATCH_FILES_ID = clauseIdOf("scratch-files");
const SECOND_EDITION = editionOf("2");

const RULE_SET_ROOT = absoluteRootOf("/repo/tools/disciplines/acme");
const INSTALL_ROOT = absoluteRootOf("/repo/node_modules/hone");
const DISCIPLINE_PATH = "/repo/tools/disciplines/acme/rules/ACME-2/discipline.json";
const PIECE_ROOT = "/repo/tools/disciplines/acme/mechanisms/audit/ACME-2";

const FLAG_CASE = { name: "scratch file", fileName: staticRepoPathOf("src/draft.scratch.ts"), source: "export const draft = 1;\n", expectedLines: [1] };
const ALLOW_CASE = { name: "ordinary file", fileName: staticRepoPathOf("src/kept.ts"), source: "export const kept = 1;\n", expectedLines: [] };

const NAMED_INTENT = { kind: "judgement", id: clauseIdOf("named-intent"), enforcedBy: "review" } as const;

const DISCIPLINE: DisciplineFile = {
  version: 1,
  id: ACME_2,
  clauses: [
    {
      kind: "mechanical",
      id: SCRATCH_FILES_ID,
      mechanisms: [AUDIT],
      anchor: { kind: "file" },
      exceptions: "allowed",
      cases: { flag: [FLAG_CASE], allow: [ALLOW_CASE] },
    },
    NAMED_INTENT,
  ],
};

const EDITIONED_DISCIPLINE: DisciplineFile = {
  version: 1,
  id: ACME_2,
  clauses: [
    {
      kind: "mechanical",
      id: SCRATCH_FILES_ID,
      mechanisms: [AUDIT],
      anchor: { kind: "file" },
      exceptions: "allowed",
      cases: { flag: [{ ...FLAG_CASE, edition: SECOND_EDITION }], allow: [ALLOW_CASE] },
    },
  ],
};

const ESLINT_ONLY_DISCIPLINE: DisciplineFile = {
  version: 1,
  id: ACME_2,
  clauses: [
    {
      kind: "mechanical",
      id: SCRATCH_FILES_ID,
      mechanisms: [ESLINT],
      anchor: { kind: "file" },
      exceptions: "allowed",
      cases: { flag: [FLAG_CASE], allow: [ALLOW_CASE] },
    },
  ],
};

const PIECE: PieceFile = {
  version: 1,
  discipline: ACME_2,
  mechanism: AUDIT,
  clauses: [
    {
      clause: SCRATCH_FILES_ID,
      settings: { module: "scratch-files.ts" },
      clauseSettings: { marker: { default: ".scratch." } },
      editions: { declared: [editionOf("1")], default: editionOf("1"), latest: editionOf("1") },
    },
  ],
};

const EDITIONED_PIECE: PieceFile = {
  version: 1,
  discipline: ACME_2,
  mechanism: AUDIT,
  clauses: [
    {
      clause: SCRATCH_FILES_ID,
      settings: { module: "scratch-files.ts" },
      clauseSettings: { marker: { default: ".scratch." } },
      editions: { declared: [editionOf("1"), SECOND_EDITION], default: editionOf("1"), latest: SECOND_EDITION },
    },
  ],
};

const EMPTY_PIECE: PieceFile = { version: 1, discipline: ACME_2, mechanism: AUDIT, clauses: [] };

const ruleSetFilesReading = (request: { readonly discipline: DisciplineFile; readonly piece: PieceFile }): RuleSetFiles => ({
  disciplineFile: vi.fn<RuleSetFiles["disciplineFile"]>().mockReturnValue({ outcome: "ok", value: { held: "present", file: request.discipline } }),
  pieceFile: vi.fn<RuleSetFiles["pieceFile"]>().mockReturnValue({ outcome: "ok", value: request.piece }),
});

const ACME_FILES = ruleSetFilesReading({ discipline: DISCIPLINE, piece: PIECE });

const ABSENT_DISCIPLINE: RuleSetFiles = {
  disciplineFile: vi.fn<RuleSetFiles["disciplineFile"]>().mockReturnValue({ outcome: "ok", value: { held: "absent" } }),
  pieceFile: vi.fn<RuleSetFiles["pieceFile"]>(),
};

const UNREADABLE_DISCIPLINE: RuleSetFiles = {
  disciplineFile: vi.fn<RuleSetFiles["disciplineFile"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" } }),
  pieceFile: vi.fn<RuleSetFiles["pieceFile"]>(),
};

const loadFailureDetailGiving = (detail: string): LoadFailureDetail => vi.fn<LoadFailureDetail>().mockReturnValue(detail);

const NO_LOAD_FAILURE_DETAIL: LoadFailureDetail = vi.fn<LoadFailureDetail>();

const pathResolving = (resolved: ReturnType<PathPort["resolve"]>): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(PIECE_ROOT),
  joinRepository: vi.fn(),
  relative: vi.fn(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue(resolved),
  fromFileUrl: vi.fn(),
});

const ACME_PATH = pathResolving({ outcome: "ok", value: RULE_SET_ROOT });

const SCRATCH_FILES = { ruleSet: { name: ruleSetNameOf("acme") }, discipline: disciplineIdOf("ACME-2"), clause: clauseIdOf("scratch-files") };

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
        ruleSetFiles: ACME_FILES, loadFailureDetail: NO_LOAD_FAILURE_DETAIL, path: ACME_PATH,
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        clause: BOUND_CLAUSE,
        cases: [FLAG_CASE, ALLOW_CASE],
      },
    });
  });

  it("reads the discipline and its audit piece from the resolved rule set root", () => {
    const ruleSetFiles = ruleSetFilesReading({ discipline: DISCIPLINE, piece: PIECE });
    boundClauseOf({
      ruleSetFiles, loadFailureDetail: NO_LOAD_FAILURE_DETAIL, path: ACME_PATH,
      mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
      clause: "acme/ACME-2#scratch-files",
    });
    expect(ruleSetFiles.disciplineFile).toHaveBeenCalledWith({ ruleSetRoot: RULE_SET_ROOT, installRoot: INSTALL_ROOT, discipline: ACME_2 });
    expect(ruleSetFiles.pieceFile).toHaveBeenCalledWith({ ruleSetRoot: RULE_SET_ROOT, installRoot: INSTALL_ROOT, mechanism: AUDIT, discipline: DISCIPLINE });
  });

  it("roots the bound clause's piece in the rule set's own mechanism folder", () => {
    const path = pathResolving({ outcome: "ok", value: RULE_SET_ROOT });
    boundClauseOf({
      ruleSetFiles: ACME_FILES, loadFailureDetail: NO_LOAD_FAILURE_DETAIL, path,
      mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
      clause: "acme/ACME-2#scratch-files",
    });
    expect(path.join).toHaveBeenCalledWith({ segments: ["/repo/tools/disciplines/acme", "mechanisms", "audit", "ACME-2"] });
  });

  it("refuses text that is not a clause address", () => {
    expect(boundClauseOf({ ruleSetFiles: ACME_FILES, loadFailureDetail: NO_LOAD_FAILURE_DETAIL, path: ACME_PATH, mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT, clause: "ACME-2" })).toEqual({
      outcome: "failed",
      error: { kind: "address-invalid", detail: "ACME-2" },
    });
  });

  it("refuses a judgement clause, which has no cases to run", () => {
    expect(
      boundClauseOf({
        ruleSetFiles: ACME_FILES, loadFailureDetail: NO_LOAD_FAILURE_DETAIL, path: ACME_PATH,
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#named-intent",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "clause-not-mechanical", detail: "acme/ACME-2#named-intent" } });
  });

  it("names the file it could not read when the discipline is missing", () => {
    const loadFailureDetail = loadFailureDetailGiving(`file-unreadable ${DISCIPLINE_PATH} ENOENT`);
    expect(
      boundClauseOf({
        ruleSetFiles: UNREADABLE_DISCIPLINE, loadFailureDetail, path: ACME_PATH,
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-unloadable", detail: `file-unreadable ${DISCIPLINE_PATH} ENOENT` } });
    expect(loadFailureDetail).toHaveBeenCalledWith({ failure: { kind: "file-unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" } });
  });

  it("refuses a discipline the rule set does not hold as an unknown discipline", () => {
    const loadFailureDetail = loadFailureDetailGiving("unknown-discipline acme/ACME-2#scratch-files");
    expect(
      boundClauseOf({
        ruleSetFiles: ABSENT_DISCIPLINE, loadFailureDetail, path: ACME_PATH,
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-unloadable", detail: "unknown-discipline acme/ACME-2#scratch-files" } });
    expect(loadFailureDetail).toHaveBeenCalledWith({ failure: { kind: "unknown-discipline", address: "acme/ACME-2#scratch-files" } });
  });

  it("refuses a clause the audit mechanism may not check, as hone check does", () => {
    const loadFailureDetail = loadFailureDetailGiving("mechanism-not-allowed acme/ACME-2#scratch-files audit");
    expect(
      boundClauseOf({
        ruleSetFiles: ruleSetFilesReading({ discipline: ESLINT_ONLY_DISCIPLINE, piece: PIECE }), loadFailureDetail, path: ACME_PATH,
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-unloadable", detail: "mechanism-not-allowed acme/ACME-2#scratch-files audit" } });
    expect(loadFailureDetail).toHaveBeenCalledWith({ failure: { kind: "mechanism-not-allowed", address: "acme/ACME-2#scratch-files", mechanism: AUDIT } });
  });

  it("refuses a clause its audit piece does not list, as hone check does", () => {
    const loadFailureDetail = loadFailureDetailGiving("piece-missing acme/ACME-2#scratch-files audit");
    expect(
      boundClauseOf({
        ruleSetFiles: ruleSetFilesReading({ discipline: DISCIPLINE, piece: EMPTY_PIECE }), loadFailureDetail, path: ACME_PATH,
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-unloadable", detail: "piece-missing acme/ACME-2#scratch-files audit" } });
    expect(loadFailureDetail).toHaveBeenCalledWith({ failure: { kind: "piece-missing", address: "acme/ACME-2#scratch-files", mechanism: AUDIT } });
  });

  it("refuses a rule set root that does not resolve", () => {
    expect(
      boundClauseOf({
        ruleSetFiles: ACME_FILES, loadFailureDetail: NO_LOAD_FAILURE_DETAIL,
        path: pathResolving({ outcome: "failed", error: { kind: "working-directory-unusable", path: "acme" } }),
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
        ruleSetFiles: ACME_FILES, loadFailureDetail: NO_LOAD_FAILURE_DETAIL, path: ACME_PATH,
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        clause: BOUND_CLAUSE,
        cases: [
          { name: "scratch file", file: staticRepoPathOf("src/draft.scratch.ts"), source: FLAG_CASE.source, edition: "1" },
          { name: "ordinary file", file: staticRepoPathOf("src/kept.ts"), source: ALLOW_CASE.source, edition: "1" },
        ],
      },
    });
  });

  it("gives each case the edition it runs under, the piece's default when it names none", () => {
    expect(
      clauseUnderTestOf({
        ruleSetFiles: ruleSetFilesReading({ discipline: EDITIONED_DISCIPLINE, piece: EDITIONED_PIECE }), loadFailureDetail: NO_LOAD_FAILURE_DETAIL, path: ACME_PATH,
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT,
        clause: "acme/ACME-2#scratch-files",
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { clause: { edition: "1" }, cases: [{ name: "scratch file", edition: "2" }, { name: "ordinary file", edition: "1" }] },
    });
  });

  it("passes a setup failure through", () => {
    expect(clauseUnderTestOf({ ruleSetFiles: ACME_FILES, loadFailureDetail: NO_LOAD_FAILURE_DETAIL, path: ACME_PATH, mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme", installRoot: INSTALL_ROOT, clause: "#" })).toEqual({
      outcome: "failed",
      error: { kind: "address-invalid", detail: "#" },
    });
  });
});

describe("repoPathOf", () => {
  it("gives a repository path for a relative path inside the repository", () => {
    expect(repoPathOf({ file: "apps/storefront/package.json" })).toEqual({
      outcome: "ok",
      value: staticRepoPathOf("apps/storefront/package.json"),
    });
  });

  it("refuses a path that leaves the repository", () => {
    expect(repoPathOf({ file: "../outside.ts" })).toEqual({
      outcome: "failed",
      error: { kind: "file-invalid", detail: "../outside.ts" },
    });
  });
});

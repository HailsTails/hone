import { describe, expect, it, vi } from "vitest";
import type { EnginePort } from "../ports/engine/engine-port.ts";
import type { LoadedEngine } from "../ports/engine/engine-run.ts";
import type { LoadedRunner } from "../ports/engine/runner-module.ts";
import type { ModuleLoaderPort } from "../ports/host/module-loader-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { RuleSetFiles } from "../ports/rule-set/rule-set-files.ts";
import type { DisciplineFile, PieceFile } from "../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { FIRST_EDITION } from "../../infrastructure/content-files/edition.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { clauseIdSchema, disciplineIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { type ClauseConformanceRequest, clauseConformanceOf } from "./clause-conformance.ts";

const INSTALL_ROOT = absolutePathSchema.parse("/install");
const AUDIT = "audit" as const;
const ACME_2 = disciplineIdSchema.parse("ACME-2");
const SCRATCH_FILES_ID = clauseIdSchema.parse("scratch-files");

const RULE_SET_ROOT = absolutePathSchema.parse("/repo/tools/disciplines/acme");
const PIECE_ROOT = "/repo/tools/disciplines/acme/mechanisms/audit/ACME-2";

const FLAG_CASE = { name: "scratch file", fileName: repoPathSchema.parse("src/draft.scratch.ts"), source: "export const draft = 1;\n", expectedLines: [1] };
const ALLOW_CASE = { name: "ordinary file", fileName: repoPathSchema.parse("src/kept.ts"), source: "export const kept = 1;\n", expectedLines: [] };

const DISCIPLINE: DisciplineFile = {
  version: 1,
  id: ACME_2,
  clauses: [
    {
      kind: "mechanical",
      id: SCRATCH_FILES_ID,
      summary: "no scratch file is committed",
      mechanisms: [AUDIT],
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
      clauseSettings: {},
      editions: { declared: [FIRST_EDITION], default: FIRST_EDITION, latest: FIRST_EDITION },
    },
  ],
};

const SCRATCH_FILES = clauseAddressSchema.parse("acme/ACME-2#scratch-files");

const BOUND_CLAUSE = {
  address: SCRATCH_FILES,
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  settings: { module: "scratch-files.ts" },
  clauseSettings: {},
  edition: "1",
};

const BOUND_CASES = [FLAG_CASE, ALLOW_CASE];

const acmeFiles = (): RuleSetFiles => ({
  disciplineFile: vi.fn<RuleSetFiles["disciplineFile"]>().mockReturnValue({ outcome: "ok", value: DISCIPLINE }),
  pieceFile: vi.fn<RuleSetFiles["pieceFile"]>().mockReturnValue({ outcome: "ok", value: PIECE }),
});

const acmePath = (): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(PIECE_ROOT),
  joinRepository: vi.fn(),
  relative: vi.fn(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({ outcome: "ok", value: RULE_SET_ROOT }),
  fromFileUrl: vi.fn(),
});

const STANDALONE_RUNNER: LoadedRunner = {
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
};

const AUDIT_ENGINE: LoadedEngine = { mechanism: AUDIT, runner: STANDALONE_RUNNER, checksRunner: undefined };

const engineLoading = (request: {
  readonly loaded: Awaited<ReturnType<EnginePort["load"]>>;
  readonly conformed: Awaited<ReturnType<EnginePort["conform"]>>;
}): EnginePort => ({
  load: vi.fn<EnginePort["load"]>().mockResolvedValue(request.loaded),
  run: { checks: vi.fn(), withRecords: vi.fn() },
  project: { checks: vi.fn(), withRecords: vi.fn() },
  conform: vi.fn<EnginePort["conform"]>().mockResolvedValue(request.conformed),
});

const conformingEngine = (conformed: Awaited<ReturnType<EnginePort["conform"]>>): EnginePort =>
  engineLoading({ loaded: { outcome: "ok", value: AUDIT_ENGINE }, conformed });

const NO_MODULES: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const conformanceRequest = (request: {
  readonly engine: EnginePort;
  readonly loadFailureDetail: LoadFailureDetail;
}): ClauseConformanceRequest => ({
  ruleSetFiles: acmeFiles(),
  path: acmePath(),
  loadFailureDetail: request.loadFailureDetail,
  engine: request.engine,
  modules: NO_MODULES,
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  mechanism: AUDIT,
  ruleSetRoot: "tools/disciplines/acme",
  clause: "acme/ACME-2#scratch-files",
});

const NO_LOAD_FAILURE_DETAIL: LoadFailureDetail = vi.fn<LoadFailureDetail>();

describe("clauseConformanceOf", () => {
  it("passes when the audit runner reproduces every case", async () => {
    await expect(
      clauseConformanceOf(conformanceRequest({ engine: conformingEngine({ outcome: "ok", value: [] }), loadFailureDetail: NO_LOAD_FAILURE_DETAIL })),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("hands the audit runner the clause bound as hone check binds it and every case", async () => {
    const engine = conformingEngine({ outcome: "ok", value: [] });
    await clauseConformanceOf(conformanceRequest({ engine, loadFailureDetail: NO_LOAD_FAILURE_DETAIL }));
    expect(engine.conform).toHaveBeenCalledWith({ clause: BOUND_CLAUSE, cases: BOUND_CASES, runner: STANDALONE_RUNNER });
  });

  it("loads the installed audit runner from the install root with the module extension it is given", async () => {
    const engine = conformingEngine({ outcome: "ok", value: [] });
    const request = conformanceRequest({ engine, loadFailureDetail: NO_LOAD_FAILURE_DETAIL });
    await clauseConformanceOf(request);
    expect(engine.load).toHaveBeenCalledWith(request);
  });

  it("reports each case the piece does not reproduce", async () => {
    await expect(
      clauseConformanceOf(
        conformanceRequest({
          engine: conformingEngine({ outcome: "ok", value: [{ clause: SCRATCH_FILES, caseName: "scratch file", expectedLines: [1], flaggedLines: [] }] }),
          loadFailureDetail: NO_LOAD_FAILURE_DETAIL,
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: [{ clause: SCRATCH_FILES, caseName: "scratch file", expectedLines: [1], flaggedLines: [] }],
    });
  });

  it("refuses with the runner's own failure when the piece cannot run", async () => {
    const loadFailureDetail = vi.fn<LoadFailureDetail>().mockReturnValue(`runner-failed audit piece-invalid ${PIECE_ROOT} no check export`);
    await expect(
      clauseConformanceOf(
        conformanceRequest({
          engine: conformingEngine({ outcome: "failed", error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "no check export" } }),
          loadFailureDetail,
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-refused", detail: `runner-failed audit piece-invalid ${PIECE_ROOT} no check export` },
    });
    expect(loadFailureDetail).toHaveBeenCalledWith({
      failure: { kind: "runner-failed", mechanism: AUDIT, failure: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "no check export" } },
    });
  });

  it("refuses when the module at the runner's path exports no runner", async () => {
    const loadFailureDetail = vi.fn<LoadFailureDetail>().mockReturnValue("runner-invalid audit no runner export");
    await expect(
      clauseConformanceOf(
        conformanceRequest({
          engine: engineLoading({
            loaded: { outcome: "failed", error: { kind: "runner-invalid", mechanism: AUDIT, detail: "no runner export" } },
            conformed: { outcome: "ok", value: [] },
          }),
          loadFailureDetail,
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-unloadable", detail: "runner-invalid audit no runner export" },
    });
    expect(loadFailureDetail).toHaveBeenCalledWith({ failure: { kind: "runner-invalid", mechanism: AUDIT, detail: "no runner export" } });
  });

  it("refuses before loading the runner when the clause cannot be bound", async () => {
    const engine = conformingEngine({ outcome: "ok", value: [] });
    await expect(
      clauseConformanceOf({ ...conformanceRequest({ engine, loadFailureDetail: NO_LOAD_FAILURE_DETAIL }), clause: "not an address" }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "address-invalid", detail: "not an address" } });
    expect(engine.load).not.toHaveBeenCalled();
  });
});

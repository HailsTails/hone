import { describe, expect, it, vi } from "vitest";
import type { EnginePort } from "../ports/engine/engine-port.ts";
import type { ModuleLoaderPort } from "../ports/host/module-loader-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { RuleSetFiles } from "../ports/rule-set/rule-set-files.ts";
import type { DisciplineFile, PieceFile } from "../../domain/rule-set/rule-set-types.ts";
import { type ConformanceTestingPorts, createConformanceTesting } from "./conformance-testing.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";

const AUDIT = "audit" as const;
const ACME_2 = disciplineIdOf("ACME-2");
const SCRATCH_FILES_ID = clauseIdOf("scratch-files");

const INSTALL_ROOT = absoluteRootOf("/install");
const BUILT_ENTRY_URL = "file:///install/api/testing.js";
const DISCIPLINE_PATH = "/install/acme/rules/ACME-2/discipline.json";
const PIECE_ROOT = "/install/acme/mechanisms/audit/ACME-2";

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
      cases: {
        flag: [{ name: "scratch file", fileName: repoPathOf("src/draft.scratch.ts"), source: "", expectedLines: [1] }],
        allow: [{ name: "ordinary file", fileName: repoPathOf("src/kept.ts"), source: "", expectedLines: [] }],
      },
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
      editions: { declared: [editionOf("1")], default: editionOf("1"), latest: editionOf("1") },
    },
  ],
};

const ACME_FILES: RuleSetFiles = {
  disciplineFile: vi.fn<RuleSetFiles["disciplineFile"]>().mockReturnValue({ outcome: "ok", value: DISCIPLINE }),
  pieceFile: vi.fn<RuleSetFiles["pieceFile"]>().mockReturnValue({ outcome: "ok", value: PIECE }),
};

const UNREADABLE_FILES: RuleSetFiles = {
  disciplineFile: vi.fn<RuleSetFiles["disciplineFile"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" } }),
  pieceFile: vi.fn<RuleSetFiles["pieceFile"]>(),
};

const INSTALL_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue(PIECE_ROOT),
  joinRepository: vi.fn(),
  relative: vi.fn(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({ outcome: "ok", value: INSTALL_ROOT }),
  fromFileUrl: vi.fn(),
};

const NO_RUNNER: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const engineRefusingTheRunner = (): EnginePort => ({
  load: vi.fn<EnginePort["load"]>().mockResolvedValue({ outcome: "failed", error: { kind: "runner-invalid", mechanism: AUDIT, detail: "no runner export" } }),
  run: { checks: vi.fn(), withRecords: vi.fn() },
  project: { checks: vi.fn(), withRecords: vi.fn() },
  conform: vi.fn<EnginePort["conform"]>(),
});

const NO_LOAD_FAILURE_DETAIL: LoadFailureDetail = vi.fn<LoadFailureDetail>().mockReturnValue("");

const portsOver = (request: Pick<ConformanceTestingPorts, "installRoot" | "ruleSetFiles" | "engine" | "loadFailureDetail">): ConformanceTestingPorts => ({
  mechanism: AUDIT,
  moduleUrl: BUILT_ENTRY_URL,
  path: INSTALL_PATH,
  modules: NO_RUNNER,
  ...request,
});

describe("createConformanceTesting", () => {
  it("loads the audit runner from the given install root with the built entry's module extension", async () => {
    const engine = engineRefusingTheRunner();
    const testing = createConformanceTesting(
      portsOver({ installRoot: { outcome: "ok", value: INSTALL_ROOT }, ruleSetFiles: ACME_FILES, engine, loadFailureDetail: NO_LOAD_FAILURE_DETAIL }),
    );
    await testing.clauseConformanceOf({ ruleSetRoot: "acme", clause: "acme/ACME-2#scratch-files" });
    expect(engine.load).toHaveBeenCalledWith({
      ruleSetRoot: "acme",
      clause: "acme/ACME-2#scratch-files",
      mechanism: AUDIT,
      ruleSetFiles: ACME_FILES,
      loadFailureDetail: NO_LOAD_FAILURE_DETAIL,
      path: INSTALL_PATH,
      modules: NO_RUNNER,
      engine,
      installRoot: INSTALL_ROOT,
      moduleExtension: ".js",
    });
  });

  it("refuses every conformance run when the entry's install root cannot be found", async () => {
    const engine = engineRefusingTheRunner();
    const loadFailureDetail = vi.fn<LoadFailureDetail>().mockReturnValue("install-root-unresolvable https://example.invalid/api/testing.js the text is not a file: URL");
    const testing = createConformanceTesting(
      portsOver({
        installRoot: {
          outcome: "failed",
          error: { kind: "install-root-unresolvable", url: "https://example.invalid/api/testing.js", detail: "the text is not a file: URL" },
        },
        ruleSetFiles: UNREADABLE_FILES,
        engine,
        loadFailureDetail,
      }),
    );
    await expect(testing.clauseConformanceOf({ ruleSetRoot: "acme", clause: "acme/ACME-2#scratch-files" })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-unloadable",
        detail: "install-root-unresolvable https://example.invalid/api/testing.js the text is not a file: URL",
      },
    });
    expect(loadFailureDetail).toHaveBeenCalledWith({
      failure: { kind: "install-root-unresolvable", url: "https://example.invalid/api/testing.js", detail: "the text is not a file: URL" },
    });
    expect(engine.load).not.toHaveBeenCalled();
  });

  it("binds a clause through the given ports", () => {
    const loadFailureDetail = vi.fn<LoadFailureDetail>().mockReturnValue(`file-unreadable ${DISCIPLINE_PATH} ENOENT`);
    const testing = createConformanceTesting(
      portsOver({ installRoot: { outcome: "ok", value: INSTALL_ROOT }, ruleSetFiles: UNREADABLE_FILES, engine: engineRefusingTheRunner(), loadFailureDetail }),
    );
    expect(testing.clauseUnderTestOf({ ruleSetRoot: "acme", clause: "acme/ACME-2#scratch-files" })).toEqual({
      outcome: "failed",
      error: { kind: "rule-set-unloadable", detail: `file-unreadable ${DISCIPLINE_PATH} ENOENT` },
    });
    expect(loadFailureDetail).toHaveBeenCalledWith({ failure: { kind: "file-unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" } });
  });

  it("gives repository paths", () => {
    const testing = createConformanceTesting(
      portsOver({ installRoot: { outcome: "ok", value: INSTALL_ROOT }, ruleSetFiles: UNREADABLE_FILES, engine: engineRefusingTheRunner(), loadFailureDetail: NO_LOAD_FAILURE_DETAIL }),
    );
    expect(testing.repoPathOf({ file: "src/kept.ts" })).toEqual({ outcome: "ok", value: repoPathOf("src/kept.ts") });
  });
});

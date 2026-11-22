import { describe, expect, it, vi } from "vitest";
import type { EnginePort } from "../ports/engine/engine-port.ts";
import type { LoadedEngine, ParsedChecksRunner } from "../ports/engine/engine-run.ts";
import type { LoadedRunner } from "../ports/engine/runner-module.ts";
import type { ModuleLoaderPort } from "../ports/host/module-loader-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { RuleSetFiles } from "../ports/rule-set/rule-set-files.ts";
import type { DisciplineFile, PieceFile } from "../../domain/rule-set/rule-set-types.ts";
import { clauseConformanceOf } from "./clause-conformance.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";

const INSTALL_ROOT = absoluteRootOf("/install");
const MECHANISM = "walker" as const;
const ACME_2 = disciplineIdOf("ACME-2");
const SCRATCH_FILES_ID = clauseIdOf("scratch-files");

const RULE_SET_ROOT = absoluteRootOf("/repo/tools/disciplines/acme");
const PIECE_ROOT = "/repo/tools/disciplines/acme/mechanisms/audit/ACME-2";

const ALLOW_CASE = { name: "ordinary file", fileName: repoPathOf("src/kept.ts"), source: "export const kept = 1;\n", expectedLines: [] };

const FLAG_CASE = { name: "scratch file", fileName: repoPathOf("src/draft.scratch.ts"), source: "export const draft = 1;\n", expectedLines: [1] };

const DISCIPLINE: DisciplineFile = {
  version: 1,
  id: ACME_2,
  clauses: [
    {
      kind: "mechanical",
      id: SCRATCH_FILES_ID,
      mechanisms: [MECHANISM],
      anchor: { kind: "file" },
      exceptions: "allowed",
      cases: { flag: [FLAG_CASE], allow: [ALLOW_CASE] },
    },
  ],
};

const PIECE: PieceFile = {
  version: 1,
  discipline: ACME_2,
  mechanism: MECHANISM,
  clauses: [
    {
      clause: SCRATCH_FILES_ID,
      settings: { module: "scratch-files.ts" },
      clauseSettings: {},
      editions: { declared: [editionOf("1")], default: editionOf("1"), latest: editionOf("1") },
    },
  ],
};

const BOUND_CLAUSE = {
  address: { ruleSet: { name: ruleSetNameOf("acme") }, discipline: disciplineIdOf("ACME-2"), clause: clauseIdOf("scratch-files") },
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  settings: { module: "scratch-files.ts" },
  clauseSettings: {},
  edition: "1",
};

const BOUND_CASES = [FLAG_CASE, ALLOW_CASE];

const acmeFiles = (): RuleSetFiles => ({
  disciplineFile: vi.fn<RuleSetFiles["disciplineFile"]>().mockReturnValue({ outcome: "ok", value: { held: "present", file: DISCIPLINE } }),
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

const standaloneRunner = (): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
});

const embeddedRunner = (): LoadedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: [],
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
  project: vi.fn<LoadedRunner["run"]>(),
});

const checksRunner = (): ParsedChecksRunner => ({
  projectedKinds: [],
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
  project: vi.fn<LoadedRunner["run"]>(),
});

const engineLoading = (request: {
  readonly loaded: Awaited<ReturnType<EnginePort["load"]>>;
  readonly conformed: Awaited<ReturnType<EnginePort["conform"]>>;
}): EnginePort => ({
  load: vi.fn<EnginePort["load"]>().mockResolvedValue(request.loaded),
  run: { checks: vi.fn(), withRecords: vi.fn() },
  project: { checks: vi.fn(), withRecords: vi.fn() },
  conform: vi.fn<EnginePort["conform"]>().mockResolvedValue(request.conformed),
});

const engineOf = (loaded: LoadedEngine): EnginePort => engineLoading({ loaded: { outcome: "ok", value: loaded }, conformed: { outcome: "ok", value: [] } });

const NO_MODULES: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const conformanceOver = (request: { readonly engine: EnginePort; readonly loadFailureDetail: LoadFailureDetail }) =>
  clauseConformanceOf({
    ruleSetFiles: acmeFiles(),
    path: acmePath(),
    loadFailureDetail: request.loadFailureDetail,
    engine: request.engine,
    modules: NO_MODULES,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    mechanism: MECHANISM,
    ruleSetRoot: "tools/disciplines/acme",
    clause: "acme/ACME-2#scratch-files",
  });

const NO_LOAD_FAILURE_DETAIL: LoadFailureDetail = vi.fn<LoadFailureDetail>();

describe("clauseConformanceOf, by the kind of engine the runner module declares", () => {
  it("asks a standalone runner's conform, even when the module also exports a checks runner", async () => {
    const runner = standaloneRunner();
    const engine = engineOf({ mechanism: MECHANISM, runner, checksRunner: checksRunner() });
    await expect(conformanceOver({ engine, loadFailureDetail: NO_LOAD_FAILURE_DETAIL })).resolves.toEqual({ outcome: "ok", value: [] });
    expect(engine.conform).toHaveBeenCalledExactlyOnceWith({ clause: BOUND_CLAUSE, cases: BOUND_CASES, runner });
  });

  it("asks the checks runner's conform, never the embedded runner's, for an engine that runs through a native tool", async () => {
    const checks = checksRunner();
    const engine = engineOf({ mechanism: MECHANISM, runner: embeddedRunner(), checksRunner: checks });
    await expect(conformanceOver({ engine, loadFailureDetail: NO_LOAD_FAILURE_DETAIL })).resolves.toEqual({ outcome: "ok", value: [] });
    expect(engine.conform).toHaveBeenCalledExactlyOnceWith({ clause: BOUND_CLAUSE, cases: BOUND_CASES, runner: checks });
  });

  it("reports the checks runner's own failure to reproduce a case", async () => {
    const engine = engineLoading({
      loaded: { outcome: "ok", value: { mechanism: MECHANISM, runner: embeddedRunner(), checksRunner: checksRunner() } },
      conformed: {
        outcome: "ok",
        value: [{ caseName: "scratch file", clause: { ruleSet: { name: ruleSetNameOf("acme") }, discipline: disciplineIdOf("ACME-2"), clause: clauseIdOf("scratch-files") }, expectedLines: [1], flaggedLines: [] }],
      },
    });
    await expect(conformanceOver({ engine, loadFailureDetail: NO_LOAD_FAILURE_DETAIL })).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          caseName: "scratch file",
          clause: { clause: "scratch-files", discipline: "ACME-2", ruleSet: { name: "acme" } },
          expectedLines: [1],
          flaggedLines: [],
        },
      ],
    });
  });

  it("is runner-unloadable, in the words conformance needs, when a native-tool engine exports no checks runner", async () => {
    const engine = engineOf({ mechanism: MECHANISM, runner: embeddedRunner(), checksRunner: undefined });
    await expect(conformanceOver({ engine, loadFailureDetail: NO_LOAD_FAILURE_DETAIL })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-unloadable",
        detail: "the runner module exports no checksRunner, which version 2 conformance needs of an engine that runs through a native tool",
      },
    });
    expect(engine.conform).not.toHaveBeenCalled();
  });

  it("is runner-unloadable when the engine refuses the runner module", async () => {
    const loadFailureDetail = vi.fn<LoadFailureDetail>().mockReturnValue("runner-invalid audit ✖ Invalid input: expected function, received undefined\\n  → at checksRunner.conform");
    const engine = engineLoading({
      loaded: {
        outcome: "failed",
        error: { kind: "runner-invalid", mechanism: MECHANISM, detail: "✖ Invalid input: expected function, received undefined\n  → at checksRunner.conform" },
      },
      conformed: { outcome: "ok", value: [] },
    });
    await expect(conformanceOver({ engine, loadFailureDetail })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-unloadable",
        detail: "runner-invalid audit ✖ Invalid input: expected function, received undefined\\n  → at checksRunner.conform",
      },
    });
    expect(loadFailureDetail).toHaveBeenCalledWith({
      failure: { kind: "runner-invalid", mechanism: MECHANISM, detail: "✖ Invalid input: expected function, received undefined\n  → at checksRunner.conform" },
    });
  });
});

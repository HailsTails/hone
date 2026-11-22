import { describe, expect, it, type Mock, vi } from "vitest";
import type { Engine, RecordKind, Rule, Symptom, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import type { ClauseBinding } from "../../../domain/settings/selection/selection.ts";
import type { RunnerCall } from "../../ports/engine/runner-module.ts";
import type { EngineRun, EngineRunRequest, LoadedEngine } from "../../ports/engine/engine-run.ts";
import type { EnginePort } from "../../ports/engine/engine-port.ts";
import type { RunnerInvalid } from "../../ports/engine/runner-location.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { Result } from "../../../domain/result.ts";
import type { RunFailureSource } from "../../../domain/report/run-failure.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import type { RecordsReading, SymptomReach } from "../../../domain/records/hone-records/hone-record.ts";
import type { SettingsReading } from "../settings/read-settings.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { DEFAULT_CONVENTIONS } from "../../../domain/settings/conventions.ts";
import { FIRST_EDITION } from "../../../infrastructure/content-files/edition.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { type EnginesRunRequest, enginesProjectionOf, enginesRunOf } from "./engines-run.ts";

const REPO = absolutePathSchema.parse("/repo");

const INSTALL = absolutePathSchema.parse("/install");

const A = repoPathSchema.parse("src/a.ts");

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const CAST_EXPRESSIONS = clauseAddressSchema.parse("CD-2#cast-expressions");

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: { name: "one-place-decides", title: "One place decides" },
  standing: "accepted",
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: {
        name: "gives-a-value-its-type",
        title: "Gives a value its type",
        standing: "accepted",
        owes: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
      },
      situation: "or needs it narrower",
      points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION }],
};

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [{ name: "one-place-decides", title: "One place decides" }],
  rules: [DECLARED_NOT_ASSERTED],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [CLAIMED_TYPE],
  clauses: [{ clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } }],
  checks: [{ name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] }],
  namedBans: [],
};

const README = repoPathSchema.parse("README.md");

const bindingOn = (request: { readonly mechanism: typeof ESLINT }): ClauseBinding => ({
  mechanism: request.mechanism,
  clause: { address: CAST_EXPRESSIONS, anchor: { kind: "file" }, pieceRoot: "/install/pieces", clauseSettings: {}, edition: FIRST_EDITION, settings: {} },
});

const settingsBinding = (request: { readonly bindings: readonly ClauseBinding[]; readonly lookup: SettingsReading["eslintConfigLookup"] }): SettingsReading => ({
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: request.bindings,
    clauseRoots: [],
    excluded: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: request.lookup,
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
});

const DEBT_ON_A: RecordsReading = {
  records: [{ place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 }, record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: A, holding: { held: "stated" } } }],
  refused: [],
  notes: [],
  base: { measured: "yes" },
};

const UNUSED_PATH: Pick<PathPort, "join"> = { join: vi.fn<PathPort["join"]>() };

const MODULES: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const UNCALLED_RUNNER: RunnerCall = vi.fn<RunnerCall>();

const AUDIT_LOADED: LoadedEngine = {
  mechanism: AUDIT,
  runner: { exceptionPath: "standalone", run: UNCALLED_RUNNER, conform: UNCALLED_RUNNER },
  checksRunner: undefined,
};

const ESLINT_LOADED: LoadedEngine = {
  mechanism: ESLINT,
  runner: { exceptionPath: "standalone", run: UNCALLED_RUNNER, conform: UNCALLED_RUNNER },
  checksRunner: undefined,
};

const AUDIT_RUN: EngineRun = {
  mechanism: AUDIT,
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
};

const ESLINT_RUN: EngineRun = { ...AUDIT_RUN, mechanism: ESLINT };

type EngineFake = {
  readonly load: Mock<EnginePort["load"]>;
  readonly runChecks: Mock<EnginePort["run"]["checks"]>;
  readonly projectChecks: Mock<EnginePort["project"]["checks"]>;
  readonly port: EnginePort;
};

const engineFake = (): EngineFake => {
  const load = vi.fn<EnginePort["load"]>();
  const runChecks = vi.fn<EnginePort["run"]["checks"]>();
  const projectChecks = vi.fn<EnginePort["project"]["checks"]>();
  return {
    load,
    runChecks,
    projectChecks,
    port: {
      load,
      run: { checks: runChecks, withRecords: vi.fn<EnginePort["run"]["withRecords"]>() },
      project: { checks: projectChecks, withRecords: vi.fn<EnginePort["project"]["withRecords"]>() },
      conform: vi.fn<EnginePort["conform"]>(),
    },
  };
};

const DETECTED: SettingsReading["eslintConfigLookup"] = { lookup: "detected" };

const enginesRequestOf = (request: {
  readonly bindings: readonly ClauseBinding[];
  readonly lookup: SettingsReading["eslintConfigLookup"];
  readonly engine: EnginePort;
}): EnginesRunRequest => ({
  catalogue: REPORT_CATALOGUE,
  settings: settingsBinding(request),
  records: DEBT_ON_A,
  tree: { tracked: [A, README], declaredConfigRoots: [] },
  repoRoot: REPO,
  installRoot: INSTALL,
  moduleExtension: ".ts",
  path: UNUSED_PATH,
  engine: request.engine,
  modules: MODULES,
});

const ESLINT_RUN_REQUEST: EngineRunRequest = {
  repoRoot: REPO,
  installRoot: INSTALL,
  files: [A],
  trackedPaths: [A, README],
  checks: REPORT_CATALOGUE.checks,
  bindings: [bindingOn({ mechanism: ESLINT })],
  answered: [{ symptom: "claimed-type", file: A }],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
};

const RUNNER_INVALID: Result<LoadedEngine, RunnerInvalid> = { outcome: "failed", error: { kind: "runner-invalid", mechanism: ESLINT, detail: "Cannot find module" } };

const NOT_READY: RunFailureSource = { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } };

describe("enginesRunOf", () => {
  it("runs each mechanism the selection binds once, loading its engine from the install", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: AUDIT_LOADED }).mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: AUDIT_RUN }).mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    const run = await enginesRunOf(
      enginesRequestOf({ bindings: [bindingOn({ mechanism: AUDIT }), bindingOn({ mechanism: ESLINT }), bindingOn({ mechanism: AUDIT })], lookup: DETECTED, engine: engine.port }),
    );
    expect({ run, loaded: engine.load.mock.calls }).toEqual({
      run: { outcome: "ok", value: [AUDIT_RUN, ESLINT_RUN] },
      loaded: [
        [expect.objectContaining({ mechanism: AUDIT, installRoot: INSTALL, moduleExtension: ".ts", modules: MODULES, path: UNUSED_PATH })],
        [expect.objectContaining({ mechanism: ESLINT, installRoot: INSTALL, moduleExtension: ".ts", modules: MODULES, path: UNUSED_PATH })],
      ],
    });
  });

  it("asks the engine to run its checks with the TypeScript files, the tracked paths, the catalogue's checks, the bindings and the files records answer", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    await enginesRunOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }));
    expect(engine.runChecks.mock.calls).toEqual([[{ engine: ESLINT_LOADED, request: ESLINT_RUN_REQUEST }]]);
  });

  it("passes the ESLint config lookup the settings declare, and none when the settings leave it to be detected", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    await enginesRunOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: { lookup: "declared", value: "repository-root" }, engine: engine.port }));
    expect(engine.runChecks.mock.calls).toEqual([
      [{ engine: ESLINT_LOADED, request: { ...ESLINT_RUN_REQUEST, declaredConfigLookup: "repository-root" } }],
    ]);
  });

  it("fails as an invalid engine, naming the engine the catalogue gives the mechanism, when its engine cannot be loaded", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce(RUNNER_INVALID);
    expect(await enginesRunOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }))).toEqual({
      outcome: "failed",
      error: { kind: "engine-invalid", engine: { named: "engine", engine: ESLINT_ENGINE }, detail: "Cannot find module" },
    });
  });

  it("fails as an engine that failed, naming the engine, when its runner fails", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks.mockResolvedValueOnce({ outcome: "failed", error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "tool-failed", detail: "ESLint stopped" } } });
    expect(await enginesRunOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }))).toEqual({
      outcome: "failed",
      error: { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "ESLint stopped" } },
    });
  });

  it("fails as not ready yet when the ESLint runner says its config roots are not ready", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks.mockResolvedValueOnce({ outcome: "failed", error: NOT_READY });
    expect(await enginesRunOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }))).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } },
    });
  });

  it("runs nothing when the selection binds no mechanism", async () => {
    const engine = engineFake();
    expect({
      run: await enginesRunOf(enginesRequestOf({ bindings: [], lookup: DETECTED, engine: engine.port })),
      loaded: engine.load.mock.calls,
    }).toEqual({ run: { outcome: "ok", value: [] }, loaded: [] });
  });
});

const WRITTEN_PROJECTION = { file: repoPathSchema.parse("hone.eslint.mjs"), text: "export default [];\n" };

describe("enginesProjectionOf", () => {
  it("gives the files the checks runner wrote", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "ok", value: [WRITTEN_PROJECTION] });
    expect(await enginesProjectionOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }))).toEqual({
      outcome: "ok",
      value: [WRITTEN_PROJECTION],
    });
  });

  it("asks the engine to project the very request it would run, so a run and a projection cannot see different inputs", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "ok", value: [] });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    await enginesProjectionOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }));
    await enginesRunOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }));
    expect({ projected: engine.projectChecks.mock.calls, run: engine.runChecks.mock.calls }).toEqual({
      projected: [[{ engine: ESLINT_LOADED, request: ESLINT_RUN_REQUEST }]],
      run: [[{ engine: ESLINT_LOADED, request: ESLINT_RUN_REQUEST }]],
    });
  });

  it("writes nothing for an engine that projects no file", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: AUDIT_LOADED });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "ok", value: [] });
    expect(await enginesProjectionOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: AUDIT })], lookup: DETECTED, engine: engine.port }))).toEqual({
      outcome: "ok",
      value: [],
    });
  });

  it("writes nothing when the selection binds no mechanism", async () => {
    const engine = engineFake();
    expect({
      projected: await enginesProjectionOf(enginesRequestOf({ bindings: [], lookup: DETECTED, engine: engine.port })),
      loaded: engine.load.mock.calls,
    }).toEqual({ projected: { outcome: "ok", value: [] }, loaded: [] });
  });

  it("fails as an invalid engine, naming the engine, when its engine cannot be loaded", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce(RUNNER_INVALID);
    expect(await enginesProjectionOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }))).toEqual({
      outcome: "failed",
      error: { kind: "engine-invalid", engine: { named: "engine", engine: ESLINT_ENGINE }, detail: "Cannot find module" },
    });
  });

  it("fails as an engine that failed, naming the engine, when the checks runner fails", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "failed", error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "tool-failed", detail: "disk full" } } });
    expect(await enginesProjectionOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }))).toEqual({
      outcome: "failed",
      error: { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "disk full" } },
    });
  });

  it("fails as not ready yet when the checks runner says its config roots are not ready", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "failed", error: NOT_READY });
    expect(await enginesProjectionOf(enginesRequestOf({ bindings: [bindingOn({ mechanism: ESLINT })], lookup: DETECTED, engine: engine.port }))).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } },
    });
  });
});

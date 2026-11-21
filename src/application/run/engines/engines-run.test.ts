import { describe, expect, it, vi } from "vitest";
import { AUDIT, CAST_EXPRESSIONS, CLAIMED_TYPE, ESLINT, ESLINT_ENGINE, REPORT_CATALOGUE, WHOLE_SYMPTOM } from "../../../../tests/report-catalogue.ts";
import type { ClauseBinding } from "../../../domain/settings/selection/selection.ts";
import type { ChecksRunRequest } from "../../../infrastructure/engines/protocol/checks/checks-runner-types.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../../../infrastructure/node/modules/module-loader-port.ts";
import { createPathPort } from "../../../infrastructure/node/path-port.ts";
import type { RecordsReading } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import type { SettingsReading } from "../settings/read-settings.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { DEFAULT_CONVENTIONS } from "../../../infrastructure/hone-config-file/conventions.ts";
import { FIRST_EDITION } from "../../../infrastructure/content-files/edition.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { enginesProjectionOf, enginesRunOf } from "./engines-run.ts";

const REPO = absolutePathSchema.parse("/repo");

const INSTALL = absolutePathSchema.parse("/install");

const A = repoPathSchema.parse("src/a.ts");

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

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const STANDALONE_MODULE = {
  runner: {
    exceptionPath: "standalone",
    run: () => Promise.resolve({ outcome: "ok", value: { hits: [], nativeExceptions: [] } }),
    conform: () => Promise.resolve({ outcome: "ok", value: [] }),
  },
};

const REPORT = { hits: [], nativeExceptions: [], measured: [], projection: "current", slices: [], misnamedRuleIds: [] };

const EMBEDDED_MODULE = {
  runner: {
    exceptionPath: "embedded",
    projectedKinds: ["config-override"],
    run: () => Promise.resolve(undefined),
    conform: () => Promise.resolve(undefined),
    project: () => Promise.resolve(undefined),
  },
  checksRunner: {
    projectedKinds: ["config-override"],
    run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: REPORT }),
    conform: vi.fn<(request: unknown) => Promise<unknown>>(),
    project: vi.fn<(request: unknown) => Promise<unknown>>(),
  },
};

const NOT_ASKED_FOR: ModuleLoad = { outcome: "failed", error: { kind: "module-unloadable", path: "/nowhere", detail: "not asked for" } };

const modulesOf = (request: { readonly first: ModuleLoad; readonly second: ModuleLoad }): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValueOnce(request.first).mockResolvedValueOnce(request.second),
});

const DETECTED: SettingsReading["eslintConfigLookup"] = { lookup: "detected" };

const runOver = (request: { readonly bindings: readonly ClauseBinding[]; readonly first: ModuleLoad; readonly second: ModuleLoad; readonly lookup: SettingsReading["eslintConfigLookup"] }) =>
  enginesRunOf({
    catalogue: REPORT_CATALOGUE,
    settings: settingsBinding(request),
    records: DEBT_ON_A,
    tree: { tracked: [A, README], declaredConfigRoots: [] },
    repoRoot: REPO,
    installRoot: INSTALL,
    moduleExtension: ".ts",
    path: POSIX_PATH,
    modules: modulesOf(request),
  });

describe("enginesRunOf", () => {
  it("runs each mechanism the selection binds once, loading its runner module from the install", async () => {
    const modules = modulesOf({ first: { outcome: "ok", value: STANDALONE_MODULE }, second: { outcome: "ok", value: EMBEDDED_MODULE } });
    const run = await enginesRunOf({
      catalogue: REPORT_CATALOGUE,
      settings: settingsBinding({ bindings: [bindingOn({ mechanism: AUDIT }), bindingOn({ mechanism: ESLINT }), bindingOn({ mechanism: AUDIT })], lookup: DETECTED }),
      records: DEBT_ON_A,
      tree: { tracked: [A, README], declaredConfigRoots: [] },
      repoRoot: REPO,
      installRoot: INSTALL,
      moduleExtension: ".ts",
      path: POSIX_PATH,
      modules,
    });
    expect(run).toMatchObject({ outcome: "ok", value: [{ mechanism: AUDIT }, { mechanism: ESLINT }] });
    expect(vi.mocked(modules.load).mock.calls).toEqual([
      [{ path: "/install/src/infrastructure/engines/audit/runner/runner.ts" }],
      [{ path: "/install/src/infrastructure/engines/eslint/runner/runner.ts" }],
    ]);
  });

  it("asks a checks runner with the TypeScript files, the tracked paths, the catalogue's checks, the bindings and the files records answer", async () => {
    const asked = vi.mocked(EMBEDDED_MODULE.checksRunner.run);
    asked.mockClear();
    await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: EMBEDDED_MODULE }, second: NOT_ASKED_FOR, lookup: DETECTED });
    const expected: ChecksRunRequest = {
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
    expect(asked.mock.calls).toEqual([[expected]]);
  });

  it("passes the ESLint config lookup the settings declare, and none when the settings leave it to be detected", async () => {
    const asked = vi.mocked(EMBEDDED_MODULE.checksRunner.run);
    asked.mockClear();
    await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: EMBEDDED_MODULE }, second: NOT_ASKED_FOR, lookup: { lookup: "declared", value: "repository-root" } });
    expect(asked.mock.calls).toEqual([[expect.objectContaining({ declaredConfigLookup: "repository-root" })]]);
  });

  it("fails as an invalid engine, naming the engine the catalogue gives the mechanism, when its module cannot be loaded", async () => {
    const unloadable: ModuleLoad = { outcome: "failed", error: { kind: "module-unloadable", path: "/install/src/infrastructure/engines/eslint/runner/runner.ts", detail: "Cannot find module" } };
    expect(await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: unloadable, second: NOT_ASKED_FOR, lookup: DETECTED })).toEqual({
      outcome: "failed",
      error: { kind: "engine-invalid", engine: { named: "engine", engine: ESLINT_ENGINE }, detail: "Cannot find module" },
    });
  });

  it("fails as an engine that failed, naming the engine, when its runner fails", async () => {
    const failing = { ...EMBEDDED_MODULE, checksRunner: { projectedKinds: [], run: () => Promise.resolve({ outcome: "failed", error: { kind: "tool-failed", detail: "ESLint stopped" } }), conform: () => Promise.resolve(undefined), project: () => Promise.resolve(undefined) } };
    expect(await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: failing }, second: NOT_ASKED_FOR, lookup: DETECTED })).toEqual({
      outcome: "failed",
      error: { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "ESLint stopped" } },
    });
  });

  it("fails as not ready yet when the ESLint runner says its config roots are not ready", async () => {
    const notReady = { ...EMBEDDED_MODULE, checksRunner: { projectedKinds: [], run: () => Promise.resolve({ outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } } }), conform: () => Promise.resolve(undefined), project: () => Promise.resolve(undefined) } };
    expect(await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: notReady }, second: NOT_ASKED_FOR, lookup: DETECTED })).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } },
    });
  });

  it("runs nothing when the selection binds no mechanism", async () => {
    expect(await runOver({ bindings: [], first: NOT_ASKED_FOR, second: NOT_ASKED_FOR, lookup: DETECTED })).toEqual({ outcome: "ok", value: [] });
  });
});

const WRITTEN_PROJECTION = { file: repoPathSchema.parse("hone.eslint.mjs"), text: "export default [];\n" };

const projectingModule = (request: { readonly returned: unknown }) => ({
  ...EMBEDDED_MODULE,
  checksRunner: { ...EMBEDDED_MODULE.checksRunner, project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue(request.returned) },
});

const projectionOver = (request: { readonly bindings: readonly ClauseBinding[]; readonly first: ModuleLoad; readonly second: ModuleLoad }) =>
  enginesProjectionOf({
    catalogue: REPORT_CATALOGUE,
    settings: settingsBinding({ bindings: request.bindings, lookup: DETECTED }),
    records: DEBT_ON_A,
    tree: { tracked: [A, README], declaredConfigRoots: [] },
    repoRoot: REPO,
    installRoot: INSTALL,
    moduleExtension: ".ts",
    path: POSIX_PATH,
    modules: modulesOf(request),
  });

describe("enginesProjectionOf", () => {
  it("gives the files the checks runner wrote", async () => {
    const module = projectingModule({ returned: { outcome: "ok", value: [WRITTEN_PROJECTION] } });
    expect(await projectionOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: module }, second: NOT_ASKED_FOR })).toEqual({ outcome: "ok", value: [WRITTEN_PROJECTION] });
  });

  it("asks the checks runner to project the very request it would run, so a run and a projection cannot see different inputs", async () => {
    const module = projectingModule({ returned: { outcome: "ok", value: [] } });
    const run = vi.mocked(EMBEDDED_MODULE.checksRunner.run);
    run.mockClear();
    await projectionOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: module }, second: NOT_ASKED_FOR });
    await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: EMBEDDED_MODULE }, second: NOT_ASKED_FOR, lookup: DETECTED });
    expect(vi.mocked(module.checksRunner.project).mock.calls).toEqual(run.mock.calls);
  });

  it("writes nothing for a standalone runner, which projects no file", async () => {
    expect(await projectionOver({ bindings: [bindingOn({ mechanism: AUDIT })], first: { outcome: "ok", value: STANDALONE_MODULE }, second: NOT_ASKED_FOR })).toEqual({ outcome: "ok", value: [] });
  });

  it("writes nothing when the selection binds no mechanism", async () => {
    expect(await projectionOver({ bindings: [], first: NOT_ASKED_FOR, second: NOT_ASKED_FOR })).toEqual({ outcome: "ok", value: [] });
  });

  it("fails as an invalid engine, naming the engine, when its module cannot be loaded", async () => {
    const unloadable: ModuleLoad = { outcome: "failed", error: { kind: "module-unloadable", path: "/install/src/infrastructure/engines/eslint/runner/runner.ts", detail: "Cannot find module" } };
    expect(await projectionOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: unloadable, second: NOT_ASKED_FOR })).toEqual({
      outcome: "failed",
      error: { kind: "engine-invalid", engine: { named: "engine", engine: ESLINT_ENGINE }, detail: "Cannot find module" },
    });
  });

  it("fails as an engine that failed, naming the engine, when the checks runner fails", async () => {
    const module = projectingModule({ returned: { outcome: "failed", error: { kind: "tool-failed", detail: "disk full" } } });
    expect(await projectionOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: module }, second: NOT_ASKED_FOR })).toEqual({
      outcome: "failed",
      error: { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "disk full" } },
    });
  });

  it("fails as not ready yet when the checks runner says its config roots are not ready", async () => {
    const module = projectingModule({ returned: { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } } } });
    expect(await projectionOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: module }, second: NOT_ASKED_FOR })).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } },
    });
  });
});

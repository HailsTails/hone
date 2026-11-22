import { describe, expect, it, vi } from "vitest";
import type { ChecksRunReport, ChecksRunner } from "../checks/checks-runner-types.ts";
import type { NativeException } from "../../../../domain/runner/runner-result-types.ts";
import type { LoadedRunner } from "../../../../application/ports/engine/runner-module.ts";
import type { ClauseBinding } from "../../../../domain/settings/selection/selection.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../../../node/path-port.ts";
import type { Check } from "../../../../domain/language-layer/symptom-catalogue.ts";
import type { EngineRunRequest } from "../../../../application/ports/engine/engine-run.ts";
import { engineProjectionOf, engineRunOf, loadedEngineOf } from "./engine-run.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";

const ESLINT = "eslint" as const;

const AUDIT = "audit" as const;

const REPO = absoluteRootOf("/repo");

const INSTALL = absoluteRootOf("/install");

const CLASS_CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") };

const A = repoPathOf("src/a.ts");

const CLASS_KEYWORD: Check = {
  name: "class-keyword",
  symptom: {
    name: "authored-class-or-this",
    title: "Authored class or this",
    seen: "a class is written",
    mayIndicate: [],
    breachUsuallySits: "in the design",
    recipes: [],
    correctUses: [],
  },
  clause: CLASS_CLAUSE,
  engines: [{ name: "eslint", mechanism: ESLINT }],
  forms: [],
};

const BINDING: ClauseBinding = {
  mechanism: ESLINT,
  clause: { address: CLASS_CLAUSE, anchor: { kind: "keyword", keyword: "class" }, pieceRoot: "/install/mechanisms/eslint/CD-14", clauseSettings: {}, edition: editionOf("1"), settings: {} },
};

const REQUEST: EngineRunRequest = {
  repoRoot: REPO,
  installRoot: INSTALL,
  files: [A],
  trackedPaths: [A],
  checks: [CLASS_KEYWORD],
  bindings: [BINDING],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
};

const HIT = { clause: CLASS_CLAUSE, file: A, anchor: { line: 1, column: 7 }, snippet: "export class A {}", check: "authored-class-or-this#class-keyword" };

const MISSING_SLICE = { slice: repoPathOf("packages/web/hone.eslint.mjs"), state: "missing" } as const;

const REPORT: ChecksRunReport = {
  hits: [HIT],
  nativeExceptions: [],
  measured: [{ clause: CLASS_CLAUSE, file: A }],
  projection: "missing",
  slices: [MISSING_SLICE],
  misnamedRuleIds: [],
};

const PROJECTED_KINDS: NativeException["kind"][] = ["config-override", "inline-disable"];

type ChecksRunResult = Awaited<ReturnType<ChecksRunner["run"]>>;

const checksRunnerReturning = (request: { readonly returned: ChecksRunResult }) => ({
  projectedKinds: PROJECTED_KINDS,
  run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue(request.returned),
  conform: vi.fn<(request: unknown) => Promise<unknown>>(),
  project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const STANDALONE: LoadedRunner = {
  exceptionPath: "standalone",
  run: () => Promise.resolve({ outcome: "ok", value: { hits: [{ clause: CLASS_CLAUSE, file: A, anchor: { line: 3, column: 1 }, snippet: "class A {}" }], nativeExceptions: [] } }),
  conform: () => Promise.resolve({ outcome: "ok", value: [] }),
};

const EMBEDDED: LoadedRunner = {
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: () => Promise.resolve({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current", slices: [] } }),
  conform: () => Promise.resolve({ outcome: "ok", value: [] }),
  project: () => Promise.resolve({ outcome: "ok", value: [] }),
};

const embeddedWith = (request: { readonly returned: ChecksRunResult }) => ({
  engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: checksRunnerReturning(request) },
  request: REQUEST,
});

describe("engineRunOf, a checks runner", () => {
  it("gives the report's hits, native exceptions, measured pairs, projection, slice problems and misnamed rule ids, coverable by the kinds the runner projects", async () => {
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "ok", value: REPORT } }))).toEqual({
      outcome: "ok",
      value: {
        mechanism: ESLINT,
        hits: [HIT],
        nativeExceptions: [],
        coverableKinds: ["config-override", "inline-disable"],
        projection: "missing",
        slices: [MISSING_SLICE],
        unprojectedFolders: [],
        measured: [{ clause: CLASS_CLAUSE, file: A }],
        misnamedRuleIds: [],
      },
    });
  });

  it("asks the runner with the files, checks, bindings and answered files it was given", async () => {
    const asked = embeddedWith({ returned: { outcome: "ok", value: REPORT } });
    await engineRunOf(asked);
    expect(vi.mocked(asked.engine.checksRunner.run).mock.calls).toEqual([[REQUEST]]);
  });

  it("fails as an invalid output when a hit is in a file the request did not hold", async () => {
    const other = repoPathOf("src/other.ts");
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "ok", value: { ...REPORT, hits: [{ ...HIT, file: other }] } } }))).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "runner-invalid-output", detail: "a hit names CD-14#class-syntax in src/other.ts, which the request did not hold" },
      },
    });
  });

  it("fails as an invalid output when the runner names a check its clause does not have", async () => {
    const hitOfAnotherCheck = { ...HIT, check: "authored-class-or-this#class-heritage" };
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "ok", value: { ...REPORT, hits: [hitOfAnotherCheck] } } }))).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: {
          kind: "runner-invalid-output",
          detail: "the report names the check authored-class-or-this#class-heritage of CD-14#class-syntax, which that clause does not have",
        },
      },
    });
  });

  it("fails with the failure the runner gave", async () => {
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "failed", error: { kind: "tool-failed", detail: "ESLint stopped" } } }))).toEqual({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "tool-failed", detail: "ESLint stopped" } },
    });
  });

  it("fails as not ready yet when the runner says its config roots are not ready", async () => {
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } } } }))).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } },
    });
  });

  it("fails as an invalid runner when an embedded runner module exports no checks runner", async () => {
    expect(await engineRunOf({ engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: undefined }, request: REQUEST })).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid",
        mechanism: ESLINT,
        detail: "the runner module exports no checksRunner, which a version 2 run needs of an engine that runs through a native tool",
      },
    });
  });

  it("fails as a failed runner when the runner throws", async () => {
    const throwing = { projectedKinds: [], run: () => Promise.reject(new Error("boom")), conform: () => Promise.resolve(undefined), project: () => Promise.resolve(undefined) };
    expect(await engineRunOf({ engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: throwing }, request: REQUEST })).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "runner-invalid-output", detail: "the runner call threw or rejected: boom" } },
    });
  });
});

describe("engineRunOf, a standalone runner", () => {
  it("gives the runner's hits with no projection", async () => {
    const request = { ...REQUEST, bindings: [{ ...BINDING, mechanism: AUDIT }] };
    expect(await engineRunOf({ engine: { mechanism: AUDIT, runner: STANDALONE, checksRunner: undefined }, request })).toEqual({
      outcome: "ok",
      value: {
        mechanism: AUDIT,
        hits: [{ clause: CLASS_CLAUSE, file: A, anchor: { line: 3, column: 1 }, snippet: "class A {}" }],
        nativeExceptions: [],
        coverableKinds: ["inline-disable"],
        projection: "none",
        slices: [],
        unprojectedFolders: [],
        measured: [],
        misnamedRuleIds: [],
      },
    });
  });
});

const WRITTEN = { file: repoPathOf("hone.eslint.mjs"), text: "export default [];\n" };

const projectingWith = (request: { readonly returned: unknown }) => ({
  engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: { ...checksRunnerReturning({ returned: { outcome: "ok", value: REPORT } }), project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue(request.returned) } },
  request: REQUEST,
});

describe("engineProjectionOf, a checks runner", () => {
  it("gives the files the runner wrote", async () => {
    expect(await engineProjectionOf(projectingWith({ returned: { outcome: "ok", value: [WRITTEN] } }))).toEqual({ outcome: "ok", value: [WRITTEN] });
  });

  it("asks the runner with the request it was given", async () => {
    const asked = projectingWith({ returned: { outcome: "ok", value: [] } });
    await engineProjectionOf(asked);
    expect(vi.mocked(asked.engine.checksRunner.project).mock.calls).toEqual([[REQUEST]]);
  });

  it("fails with the failure the runner gave", async () => {
    expect(await engineProjectionOf(projectingWith({ returned: { outcome: "failed", error: { kind: "tool-failed", detail: "disk full" } } }))).toEqual({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "tool-failed", detail: "disk full" } },
    });
  });

  it("fails as not ready yet when the runner says its config roots are not ready", async () => {
    expect(await engineProjectionOf(projectingWith({ returned: { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } } } }))).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } },
    });
  });

  it("fails as an invalid output when the runner returns something that is not a list of written files", async () => {
    expect(await engineProjectionOf(projectingWith({ returned: { outcome: "ok", value: "written" } }))).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "runner-invalid-output" } },
    });
  });

  it("fails as a failed runner when the runner throws", async () => {
    const throwing = { engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: { ...checksRunnerReturning({ returned: { outcome: "ok", value: REPORT } }), project: () => Promise.reject(new Error("boom")) } }, request: REQUEST };
    expect(await engineProjectionOf(throwing)).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "runner-invalid-output", detail: "the runner call threw or rejected: boom" } },
    });
  });

  it("fails as an invalid runner when an embedded runner module exports no checks runner", async () => {
    expect(await engineProjectionOf({ engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: undefined }, request: REQUEST })).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ESLINT },
    });
  });
});

describe("engineProjectionOf, a standalone runner", () => {
  it("writes nothing, as a standalone runner projects nothing", async () => {
    expect(await engineProjectionOf({ engine: { mechanism: AUDIT, runner: STANDALONE, checksRunner: undefined }, request: REQUEST })).toEqual({ outcome: "ok", value: [] });
  });
});

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const loaderGiving = (request: { readonly loaded: ModuleLoad }): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue(request.loaded),
});

const loadedWith = (request: { readonly mechanism: typeof ESLINT; readonly loaded: ModuleLoad }) =>
  loadedEngineOf({ mechanism: request.mechanism, installRoot: INSTALL, moduleExtension: ".ts", path: POSIX_PATH, modules: loaderGiving(request) });

describe("loadedEngineOf", () => {
  it("loads the module at the install's runner path for the mechanism", async () => {
    const modules = loaderGiving({ loaded: { outcome: "ok", value: { runner: STANDALONE } } });
    await loadedEngineOf({ mechanism: AUDIT, installRoot: INSTALL, moduleExtension: ".ts", path: POSIX_PATH, modules });
    expect(modules.load).toHaveBeenCalledExactlyOnceWith({ path: "/install/src/infrastructure/engines/audit/runner/runner.ts" });
  });

  it("fails as an invalid runner when the runner's exception path is outside every path", async () => {
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: { runner: { ...STANDALONE, exceptionPath: "unknown-path" } } } })).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ESLINT },
    });
  });

  it("loads the runner and the checks runner a mechanism's module exports", async () => {
    const checksRunner = { projectedKinds: ["config-override"], run: () => Promise.resolve(undefined), conform: () => Promise.resolve(undefined), project: () => Promise.resolve(undefined) };
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: { runner: STANDALONE, checksRunner } } })).toMatchObject({
      outcome: "ok",
      value: { mechanism: ESLINT, runner: { exceptionPath: "standalone" }, checksRunner: { projectedKinds: ["config-override"] } },
    });
  });

  it("loads a mechanism whose module exports no checks runner", async () => {
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: { runner: STANDALONE } } })).toMatchObject({
      outcome: "ok",
      value: { mechanism: ESLINT, checksRunner: undefined },
    });
  });

  it("fails as an invalid runner when the module's checks runner exports no conform", async () => {
    const checksRunner = { projectedKinds: ["config-override"], run: () => Promise.resolve(undefined), project: () => Promise.resolve(undefined) };
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: { runner: STANDALONE, checksRunner } } })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ESLINT, detail: "✖ Invalid input: expected function, received undefined\n  → at checksRunner.conform" },
    });
  });

  it("fails as an invalid runner when the module's checks runner exports no project", async () => {
    const checksRunner = { projectedKinds: ["config-override"], run: () => Promise.resolve(undefined), conform: () => Promise.resolve(undefined) };
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: { runner: STANDALONE, checksRunner } } })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ESLINT, detail: "✖ Invalid input: expected function, received undefined\n  → at checksRunner.project" },
    });
  });

  it("fails as an invalid runner, in the loader's words, when the module cannot be loaded", async () => {
    const unloadable: ModuleLoad = { outcome: "failed", error: { kind: "module-unloadable", path: "/install/mechanisms/eslint/runner/runner.ts", detail: "Cannot find module" } };
    expect(await loadedWith({ mechanism: ESLINT, loaded: unloadable })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ESLINT, detail: "Cannot find module" },
    });
  });

  it("fails as an invalid runner when the module exports no runner", async () => {
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: {} } })).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ESLINT },
    });
  });
});

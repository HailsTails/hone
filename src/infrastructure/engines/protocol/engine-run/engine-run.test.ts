import { assert, describe, expect, it, vi } from "vitest";

import type { NamedEngineLocation } from "../../../../application/ports/engine/engine-port.ts";
import type { NamedEngineRunRequest } from "../../../../application/ports/engine/engine-run.ts";
import type { RunnerModuleOf } from "../../../../application/ports/engine/runner-location.ts";
import type { RunnerCall } from "../../../../application/ports/engine/runner-module.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import { createPathPort } from "../../../node/path-port.ts";
import {
  createNamedEnginePort,
  createRunnerLoader,
  measureVersionOneProjectionOver,
} from "./engine-run.ts";

const REPO = absoluteRootOf("/repo");
const INSTALL = absoluteRootOf("/install");
const FILE_A = repoPathOf("src/a.ts");

const namedRunner = () => ({
  fileScope: "tracked",
  projectedKinds: [],
  run: vi.fn(),
  conform: vi.fn(),
  project: vi.fn(),
});

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const LOCATION: NamedEngineLocation = {
  mechanism: "walker",
  installRoot: INSTALL,
  moduleExtension: ".ts",
  path: POSIX_PATH,
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
};

describe("createRunnerLoader", () => {
  it("loads a named runner through the runner module it is given, at the selected engine’s location", async () => {
    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: namedRunner() } });
    const loadedNamedRunnerOf = createRunnerLoader({ runnerModuleOf });
    await expect(loadedNamedRunnerOf(LOCATION)).resolves.toMatchObject({
      outcome: "ok",
      value: { fileScope: "tracked", projectedKinds: [] },
    });
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(LOCATION);
  });

  it.each([
    { field: "namedChecksRunner", exported: {} },
    {
      field: "fileScope",
      exported: { namedChecksRunner: { ...namedRunner(), fileScope: "unknown" } },
    },
    { field: "conform", exported: { namedChecksRunner: { ...namedRunner(), conform: undefined } } },
    { field: "project", exported: { namedChecksRunner: { ...namedRunner(), project: undefined } } },
  ])("refuses an invalid runner export at $field", async ({ field, exported }) => {
    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: exported });
    const loadedNamedRunnerOf = createRunnerLoader({ runnerModuleOf });
    await expect(loadedNamedRunnerOf(LOCATION)).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-invalid",
        mechanism: "walker",
        detail: expect.stringContaining(field),
      },
    });
  });

  it("preserves the module loader’s failure detail", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue({
      outcome: "failed",
      error: { kind: "module-unloadable", path: "/install/runner.ts", detail: "install missing" },
    });
    const loadedNamedRunnerOf = createRunnerLoader({ runnerModuleOf });
    await expect(loadedNamedRunnerOf(LOCATION)).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "walker", detail: "install missing" },
    });
  });
});

const BINDING: CheckBinding = {
  address: "leftover-debugging#debug-call",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/pieces/debug-call",
  settings: { module: "debug-call.ts" },
  checkSettings: {},
  edition: editionOf("1"),
};

const CONFIG = repoPathOf("tsconfig.json");
const REQUEST: NamedEngineRunRequest = {
  repoRoot: REPO,
  installRoot: INSTALL,
  files: [FILE_A],
  trackedPaths: [FILE_A, CONFIG],
  bindings: [
    BINDING,
    { ...BINDING, address: "leftover-debugging#debug-statement", engine: "eslint" },
  ],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
  testFiles: { suffixes: ["test", "spec"], folders: [] },
};

describe("createNamedEnginePort", () => {
  it("returns the runner load failure for the requested engine", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue({
      outcome: "failed",
      error: { kind: "module-unloadable", path: "/install/runner.ts", detail: "install missing" },
    });
    const engine = createNamedEnginePort({ runnerModuleOf });

    const loaded = await engine.load(LOCATION);

    expect(loaded).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "walker", detail: "install missing" },
    });
  });

  it("passes only the engine's named bindings and accepts a walker measurement on a tracked config file", async () => {
    const measured = [{ check: BINDING.address, file: CONFIG }];
    const report = {
      hits: [],
      nativeExceptions: [],
      measured,
      projection: "not-included",
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
    };
    const run = vi.fn<RunnerCall>().mockResolvedValue({ outcome: "ok", value: report });
    const runner = {
      fileScope: "tracked",
      projectedKinds: [],
      run,
      conform: vi.fn(),
      project: vi.fn(),
    };

    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load(LOCATION);
    assert(engine.outcome === "ok");

    const measuredRun = await engine.value.run(REQUEST);

    expect(measuredRun).toEqual({
      outcome: "ok",
      value: { ...report, mechanism: "walker", coverableKinds: [] },
    });
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(LOCATION);
    expect(run).toHaveBeenCalledExactlyOnceWith({ ...REQUEST, bindings: [BINDING] });
  });

  it("honors the runner's TypeScript scope even when the mechanism is walker", async () => {
    const runner = {
      fileScope: "typescript",
      projectedKinds: [],
      run: vi.fn<RunnerCall>().mockResolvedValue({
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [{ check: BINDING.address, file: CONFIG }],
          projection: "not-included",
          slices: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
        },
      }),
      conform: vi.fn(),
      project: vi.fn(),
    };
    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load(LOCATION);
    assert(engine.outcome === "ok");

    const reported = await engine.value.run(REQUEST);

    expect(reported).toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: { kind: "runner-invalid-output" },
      },
    });
  });

  it("refuses a version one slice result during a regular named run", async () => {
    const runner = {
      fileScope: "tracked",
      projectedKinds: [],
      run: vi.fn<RunnerCall>().mockResolvedValue({
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          measured: [],
          projection: "not-included",
          slices: [{ slice: "packages/example/disciplines.eslint.mjs", state: "not-applied" }],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
        },
      }),
      conform: vi.fn(),
      project: vi.fn(),
    };

    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load({
      ...LOCATION,
      mechanism: "eslint",
      projectionKind: "mjs",
    });
    assert(engine.outcome === "ok");

    const reported = await engine.value.run(REQUEST);

    expect(reported).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "eslint",
        failure: {
          kind: "runner-invalid-output",
          detail: expect.stringContaining("slices"),
        },
      },
    });
  });

  it("refuses a measurement for a check selected on a different engine", async () => {
    const report = {
      hits: [],
      nativeExceptions: [],
      measured: [{ check: "leftover-debugging#debug-statement", file: FILE_A }],
      projection: "not-included",
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
    };
    const runner = {
      fileScope: "tracked",
      projectedKinds: [],
      run: vi.fn<RunnerCall>().mockResolvedValue({ outcome: "ok", value: report }),
      conform: vi.fn(),
      project: vi.fn(),
    };

    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load(LOCATION);
    assert(engine.outcome === "ok");

    const reported = await engine.value.run(REQUEST);

    expect(reported).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: {
          kind: "runner-invalid-output",
          detail:
            "a measured pair names leftover-debugging#debug-statement in src/a.ts, which the request did not hold",
        },
      },
    });
  });

  it("refuses a finding outside the requested files", async () => {
    const runner = {
      ...namedRunner(),
      run: vi.fn().mockResolvedValue({
        outcome: "ok",
        value: {
          hits: [
            {
              check: BINDING.address,
              file: repoPathOf("src/elsewhere.ts"),
              anchor: { line: 1, column: 0 },
              snippet: "class Found {}",
            },
          ],
          nativeExceptions: [],
          measured: [],
          projection: "none",
          slices: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
        },
      }),
    };
    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load(LOCATION);
    assert(engine.outcome === "ok");

    const reported = await engine.value.run(REQUEST);

    expect(reported).toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: { kind: "runner-invalid-output" },
      },
    });
  });

  it("rejects the retired configuration roots failure as invalid runner output", async () => {
    const notReady = {
      outcome: "failed",
      error: {
        kind: "not-ready-yet",
        what: { thing: "eslint-config-roots", paths: ["packages/a"] },
      },
    };
    const runner = { ...namedRunner(), run: vi.fn().mockResolvedValue(notReady) };
    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load(LOCATION);
    assert(engine.outcome === "ok");

    const reported = await engine.value.run(REQUEST);

    expect(reported).toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: { kind: "runner-invalid-output" },
      },
    });
  });

  it("reports a rejected runner call as invalid output", async () => {
    const runner = {
      ...namedRunner(),
      run: vi.fn().mockRejectedValue(new Error("engine crashed")),
    };
    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load(LOCATION);
    assert(engine.outcome === "ok");

    const reported = await engine.value.run(REQUEST);

    expect(reported).toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: {
          kind: "runner-invalid-output",
          detail: expect.stringContaining("engine crashed"),
        },
      },
    });
  });

  it("projects only the selected engine’s bindings and returns its requested writes", async () => {
    const response = {
      outcome: "ok",
      value: [{ kind: "write", file: CONFIG, text: "export default [];\n" }],
    };
    const project = vi.fn().mockResolvedValue(response);
    const runner = { ...namedRunner(), project };
    const runnerModuleOf = vi
      .fn<RunnerModuleOf>()
      .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load(LOCATION);
    assert(engine.outcome === "ok");

    const projectedFiles = await engine.value.project(REQUEST);

    expect(projectedFiles).toEqual(response);
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(LOCATION);
    expect(project).toHaveBeenCalledExactlyOnceWith({ ...REQUEST, bindings: [BINDING] });
  });

  it("passes the required projection kind only into the named ESLint runner request", async () => {
    const project = vi.fn<RunnerCall>().mockResolvedValue({ outcome: "ok", value: [] });
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue({
      outcome: "ok",
      value: { namedChecksRunner: { ...namedRunner(), project } },
    });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load({
      ...LOCATION,
      mechanism: "eslint",
      projectionKind: "ts",
    });
    assert(engine.outcome === "ok");

    const projected = await engine.value.project(REQUEST);

    expect(projected).toEqual({ outcome: "ok", value: [] });
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith({ ...LOCATION, mechanism: "eslint" });
    expect(project).toHaveBeenCalledExactlyOnceWith({
      ...REQUEST,
      bindings: [REQUEST.bindings[1]],
      projectionKind: "ts",
    });
  });

  it("refuses a projection result that contains no file path", async () => {
    const project = vi.fn().mockResolvedValue({ outcome: "ok", value: [{ text: "no file" }] });
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue({
      outcome: "ok",
      value: { namedChecksRunner: { ...namedRunner(), project } },
    });
    const engine = await createNamedEnginePort({ runnerModuleOf }).load(LOCATION);
    assert(engine.outcome === "ok");

    const reported = await engine.value.project(REQUEST);

    expect(reported).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", failure: { kind: "runner-invalid-output" } },
    });
  });
});

describe("measureVersionOneProjectionOver", () => {
  it("uses an engine’s declared upgrade export and returns the inspected slice separately from the named report", async () => {
    const slice = repoPathOf("packages/web/disciplines.eslint.mjs");
    const projection = {
      settingsFile: "disciplines.json",
      projectionFile: repoPathOf("disciplines.eslint.mjs"),
      packageFiles: [slice],
      rules: new Map(),
    };
    const report = {
      hits: [],
      nativeExceptions: [],
      measured: [],
      projection: "not-included",
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
    };
    const upgradeExport = vi.fn().mockResolvedValue({
      outcome: "ok",
      value: { report, unappliedSlices: [slice] },
    });
    const run = vi.fn<RunnerCall>();
    const runner = {
      fileScope: "typescript",
      projectedKinds: [],
      run,
      conform: vi.fn(),
      project: vi.fn(),
    };
    const measureVersionOneProjection = measureVersionOneProjectionOver({
      runnerModuleOf: vi.fn<RunnerModuleOf>().mockResolvedValue({
        outcome: "ok",
        value: { namedChecksRunner: runner, measureVersionOne: upgradeExport },
      }),
    });

    await expect(
      measureVersionOneProjection({
        request: REQUEST,
        location: LOCATION,
        projection,
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        report: { ...report, mechanism: "walker", coverableKinds: [] },
        unappliedSlices: [slice],
      },
    });
    expect(upgradeExport).toHaveBeenCalledExactlyOnceWith({
      run: {
        ...REQUEST,
        bindings: [BINDING],
      },
      projection,
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("returns an invalid runner when version one measurement cannot load the named module", async () => {
    const runnerModuleOf = vi.fn<RunnerModuleOf>().mockResolvedValue({
      outcome: "failed",
      error: { kind: "module-unloadable", path: "/install/runner.ts", detail: "install missing" },
    });
    const measureVersionOne = measureVersionOneProjectionOver({ runnerModuleOf });

    const measured = await measureVersionOne({
      request: REQUEST,
      location: LOCATION,
      projection: undefined,
    });

    expect(measured).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "walker", detail: "install missing" },
    });
    expect(runnerModuleOf).toHaveBeenCalledExactlyOnceWith(LOCATION);
  });

  it.each([
    { label: "no projection", projection: undefined },
    {
      label: "no upgrade export",
      projection: {
        settingsFile: "disciplines.json",
        projectionFile: repoPathOf("disciplines.eslint.mjs"),
        packageFiles: [],
        rules: new Map(),
      },
    },
  ])("uses the named run in the absence of $label", async ({ projection }) => {
    const report = {
      hits: [],
      nativeExceptions: [],
      measured: [{ check: BINDING.address, file: CONFIG }],
      projection: "none",
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
    };
    const run = vi.fn<RunnerCall>().mockResolvedValue({ outcome: "ok", value: report });
    const runner = {
      fileScope: "tracked",
      projectedKinds: [],
      run,
      conform: vi.fn(),
      project: vi.fn(),
    };
    const measureVersionOneProjection = measureVersionOneProjectionOver({
      runnerModuleOf: vi
        .fn<RunnerModuleOf>()
        .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: runner } }),
    });

    await expect(
      measureVersionOneProjection({
        request: REQUEST,
        location: LOCATION,
        projection,
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        report: { ...report, mechanism: "walker", coverableKinds: [] },
        unappliedSlices: [],
      },
    });
    expect(run).toHaveBeenCalledExactlyOnceWith({ ...REQUEST, bindings: [BINDING] });
  });
});

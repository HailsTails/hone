import { describe, expect, it, vi } from "vitest";

import type {
  NamedEngineRunRequest,
  ParsedNamedRunner,
} from "../../../../application/ports/engine/engine-run.ts";
import type {
  ModuleLoad,
  ModuleLoaderPort,
} from "../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import { createPathPort } from "../../../node/path-port.ts";
import {
  loadedNamedRunnerOf,
  measureVersionOneProjection,
  namedEngineProjectionOf,
  namedEngineRunOf,
} from "./engine-run.ts";

const REPO = absoluteRootOf("/repo");
const INSTALL = absoluteRootOf("/install");
const A = repoPathOf("src/a.ts");

const namedRunner = (): ParsedNamedRunner => ({
  fileScope: "tracked",
  projectedKinds: [],
  run: vi.fn(),
  conform: vi.fn(),
  project: vi.fn(),
});

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const loaderGiving = (request: { readonly loaded: ModuleLoad }): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue(request.loaded),
});

const locationOf = (modules: ModuleLoaderPort) => ({
  mechanism: ID,
  installRoot: INSTALL,
  moduleExtension: EXTENSION,
  path: POSIX_PATH,
  modules,
});

const ID: Parameters<typeof loadedNamedRunnerOf>[0]["mechanism"] = "walker";
const EXTENSION: Parameters<typeof loadedNamedRunnerOf>[0]["moduleExtension"] = ".ts";

describe("loadedNamedRunnerOf", () => {
  it("loads a named runner from the selected engine’s installed path", async () => {
    const runner = namedRunner();
    const modules = loaderGiving({
      loaded: { outcome: "ok", value: { namedChecksRunner: runner } },
    });
    await expect(loadedNamedRunnerOf(locationOf(modules))).resolves.toMatchObject({
      outcome: "ok",
      value: { fileScope: "tracked", projectedKinds: [] },
    });
    expect(modules.load).toHaveBeenCalledExactlyOnceWith({
      path: "/install/src/infrastructure/engines/walker/runner/runner.ts",
    });
  });

  it.each([
    { key: "namedChecksRunner", value: {} },
    { key: "fileScope", value: { namedChecksRunner: { ...namedRunner(), fileScope: "unknown" } } },
    { key: "conform", value: { namedChecksRunner: { ...namedRunner(), conform: undefined } } },
    { key: "project", value: { namedChecksRunner: { ...namedRunner(), project: undefined } } },
  ])("refuses an invalid runner export at $key", async ({ key, value }) => {
    const modules = loaderGiving({ loaded: { outcome: "ok", value } });
    await expect(loadedNamedRunnerOf(locationOf(modules))).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ID, detail: expect.stringContaining(key) },
    });
  });

  it("preserves the module loader’s failure detail", async () => {
    const modules = loaderGiving({
      loaded: {
        outcome: "failed",
        error: { kind: "module-unloadable", path: "/install/runner.ts", detail: "install missing" },
      },
    });
    await expect(loadedNamedRunnerOf(locationOf(modules))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ID, detail: "install missing" },
    });
  });
});

describe("namedEngineRunOf", () => {
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
    files: [A],
    trackedPaths: [A, CONFIG],
    bindings: [
      BINDING,
      { ...BINDING, address: "leftover-debugging#debug-statement", engine: "eslint" },
    ],
    answered: [],
    declaredConfigRoots: [],
    declaredConfigLookup: undefined,
  };

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
    const run = vi
      .fn<ParsedNamedRunner["run"]>()
      .mockResolvedValue({ outcome: "ok", value: report });
    const runner: ParsedNamedRunner = {
      fileScope: "tracked",
      projectedKinds: [],
      run,
      conform: vi.fn(),
      project: vi.fn(),
    };

    await expect(
      namedEngineRunOf({ mechanism: "walker", runner, request: REQUEST }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { ...report, mechanism: "walker", coverableKinds: [] },
    });
    expect(run).toHaveBeenCalledExactlyOnceWith({ ...REQUEST, bindings: [BINDING] });
  });

  it("honors the runner's TypeScript scope even when the mechanism is walker", async () => {
    const runner: ParsedNamedRunner = {
      fileScope: "typescript",
      projectedKinds: [],
      run: vi.fn<ParsedNamedRunner["run"]>().mockResolvedValue({
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
    await expect(
      namedEngineRunOf({ mechanism: "walker", runner, request: REQUEST }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: { kind: "runner-invalid-output" },
      },
    });
  });

  it("refuses a version one slice result during a regular named run", async () => {
    const runner: ParsedNamedRunner = {
      fileScope: "tracked",
      projectedKinds: [],
      run: vi.fn<ParsedNamedRunner["run"]>().mockResolvedValue({
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

    await expect(
      namedEngineRunOf({ mechanism: "eslint", runner, request: REQUEST }),
    ).resolves.toEqual({
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
    const measureVersionOne = vi.fn().mockResolvedValue({
      outcome: "ok",
      value: { report, unappliedSlices: [slice] },
    });
    const run = vi.fn<ParsedNamedRunner["run"]>();
    const runner: ParsedNamedRunner = {
      fileScope: "typescript",
      projectedKinds: [],
      run,
      conform: vi.fn(),
      project: vi.fn(),
    };
    const modules = loaderGiving({ loaded: { outcome: "ok", value: { measureVersionOne } } });

    await expect(
      measureVersionOneProjection({
        call: { mechanism: "walker", runner, request: REQUEST },
        location: {
          installRoot: INSTALL,
          mechanism: "walker",
          moduleExtension: ".ts",
          path: POSIX_PATH,
          modules,
        },
        projection,
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        report: { ...report, mechanism: "walker", coverableKinds: [] },
        unappliedSlices: [slice],
      },
    });
    expect(measureVersionOne).toHaveBeenCalledExactlyOnceWith({
      run: {
        ...REQUEST,
        bindings: [BINDING],
      },
      projection,
    });
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    { label: "no projection", inspected: false },
    { label: "no upgrade export", inspected: true },
  ])("uses the named run in the absence of $label", async ({ inspected }) => {
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
    const run = vi
      .fn<ParsedNamedRunner["run"]>()
      .mockResolvedValue({ outcome: "ok", value: report });
    const runner: ParsedNamedRunner = {
      fileScope: "tracked",
      projectedKinds: [],
      run,
      conform: vi.fn(),
      project: vi.fn(),
    };
    const modules = loaderGiving({ loaded: { outcome: "ok", value: {} } });
    const projection = inspected
      ? {
          settingsFile: "disciplines.json",
          projectionFile: repoPathOf("disciplines.eslint.mjs"),
          packageFiles: [],
          rules: new Map(),
        }
      : undefined;

    await expect(
      measureVersionOneProjection({
        call: { mechanism: "walker", runner, request: REQUEST },
        location: {
          installRoot: INSTALL,
          mechanism: "walker",
          moduleExtension: ".ts",
          path: POSIX_PATH,
          modules,
        },
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

  it("refuses a measurement for a check selected on a different engine", async () => {
    const report = {
      hits: [],
      nativeExceptions: [],
      measured: [{ check: "leftover-debugging#debug-statement", file: A }],
      projection: "not-included",
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
    };
    const runner: ParsedNamedRunner = {
      fileScope: "tracked",
      projectedKinds: [],
      run: vi.fn<ParsedNamedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: report }),
      conform: vi.fn(),
      project: vi.fn(),
    };

    await expect(
      namedEngineRunOf({ mechanism: "walker", runner, request: REQUEST }),
    ).resolves.toEqual({
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
    await expect(
      namedEngineRunOf({ mechanism: "walker", runner, request: REQUEST }),
    ).resolves.toMatchObject({
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
    await expect(
      namedEngineRunOf({ mechanism: "walker", runner, request: REQUEST }),
    ).resolves.toMatchObject({
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
    await expect(
      namedEngineRunOf({ mechanism: "walker", runner, request: REQUEST }),
    ).resolves.toMatchObject({
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
    const response = { outcome: "ok", value: [{ file: CONFIG, text: "export default [];\n" }] };
    const project = vi.fn().mockResolvedValue(response);
    const runner = { ...namedRunner(), project };
    await expect(
      namedEngineProjectionOf({ mechanism: "walker", runner, request: REQUEST }),
    ).resolves.toEqual(response);
    expect(project).toHaveBeenCalledExactlyOnceWith({ ...REQUEST, bindings: [BINDING] });
  });

  it("refuses a projection result that contains no file path", async () => {
    const project = vi.fn().mockResolvedValue({ outcome: "ok", value: [{ text: "no file" }] });
    await expect(
      namedEngineProjectionOf({
        mechanism: "walker",
        runner: { ...namedRunner(), project },
        request: REQUEST,
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", failure: { kind: "runner-invalid-output" } },
    });
  });
});

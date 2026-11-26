import { describe, expect, it, type Mock, vi } from "vitest";

import type { Check, Engine } from "../../../domain/language-layer/symptom-catalogue.ts";
import { answeredFilesOf } from "../../../domain/records/answering/answered-files.ts";
import type {
  RecordsReading,
  SymptomReach,
} from "../../../domain/records/hone-records/hone-record.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../domain/result.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import { DEFAULT_CONVENTIONS } from "../../../domain/settings/conventions.ts";
import type { NamedEnginePort } from "../../ports/engine/engine-port.ts";
import type {
  EngineCheck,
  NamedEngineRun,
  NamedEngineRunRequest,
  ParsedNamedRunner,
} from "../../ports/engine/engine-run.ts";
import type { RunnerInvalid } from "../../ports/engine/runner-location.ts";
import type { RunnerCall } from "../../ports/engine/runner-module.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { NamedSettingsReading } from "../settings/read-settings.ts";
import {
  type NamedEnginesRequest,
  namedEngineProjectionsOf,
  namedEngineRunsOf,
} from "./named-engines-run.ts";

const REPO = absoluteRootOf("/repo");

const INSTALL = absoluteRootOf("/install");

const A = repoPathOf("src/a.ts");

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const ESLINT_ENGINE: Engine = { name: "eslint" };

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: { ruleSet: "hone", name: "claimed-type" },
  page: "claimed-type/cast-expressions.md",
  engines: [ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const CAST_ENGINE_CHECK: EngineCheck = {
  name: "cast-expressions",
  symptom: { ruleSet: "hone", name: "claimed-type", title: "Claimed type" },
  engines: [ESLINT_ENGINE],
};

const README = repoPathOf("README.md");

const bindingOn = (request: { readonly mechanism: EngineId }): CheckBinding => ({
  engine: request.mechanism,
  address: "claimed-type#cast-expressions",
  ruleSet: "hone",
  anchor: { kind: "file" },
  pieceRoot: "/install/pieces",
  checkSettings: {},
  edition: editionOf("1"),
  settings: {},
});

const selectedOn = (request: {
  readonly mechanism: CheckBinding["engine"];
}): NamedSettingsReading["selection"]["selected"][number] => ({
  address: { ruleSet: "hone", check: "claimed-type#cast-expressions" },
  check: CAST_CHECK,
  exceptions: "allowed",
  editions: { declared: [editionOf("1")], default: editionOf("1"), latest: editionOf("1") },
  binding: bindingOn(request),
});

const settingsBinding = (request: {
  readonly selected: NamedSettingsReading["selection"]["selected"];
  readonly lookup: NamedSettingsReading["eslintConfigLookup"];
}): NamedSettingsReading => ({
  available: [],
  selection: {
    selected: request.selected,
    notAdopted: [],
    notRun: [],
    excluded: [],
    eslintConfigRoots: [],
  },
  runSettings: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: request.lookup,
  eslintProjectionKind: "mjs",
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
});

const DEBT_ON_A: RecordsReading = {
  records: [
    {
      place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
      record: {
        kind: "debt",
        symptom: { ruleSet: "hone", name: "claimed-type" },
        reach: WHOLE_SYMPTOM,
        file: A,
        holding: { held: "stated" },
      },
    },
  ],
  refused: [],
  notes: [],
  base: { measured: "yes", held: [] },
};

const UNUSED_PATH: Pick<PathPort, "join"> = { join: vi.fn<PathPort["join"]>() };

const MODULES: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const UNCALLED_RUNNER: RunnerCall = vi.fn<RunnerCall>();

const AUDIT_LOADED: ParsedNamedRunner = {
  fileScope: "tracked",
  projectedKinds: [],
  run: UNCALLED_RUNNER,
  conform: UNCALLED_RUNNER,
  project: UNCALLED_RUNNER,
  outputPaths: UNCALLED_RUNNER,
};

const ESLINT_LOADED: ParsedNamedRunner = { ...AUDIT_LOADED, fileScope: "typescript" };

const AUDIT_RUN: NamedEngineRun = {
  mechanism: AUDIT,
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  slices: [],
  measured: [],
  nestedConfigurations: [],
  unprojectedFolders: [],
  misnamedRuleIds: [],
};

const ESLINT_RUN: NamedEngineRun = { ...AUDIT_RUN, mechanism: ESLINT };

const engineFake = () => {
  const load = vi.fn<NamedEnginePort["load"]>();
  const runChecks = vi.fn<NamedEnginePort["run"]>();
  const projectChecks = vi.fn<NamedEnginePort["project"]>();
  const outputPaths = vi
    .fn<NamedEnginePort["outputPaths"]>()
    .mockResolvedValue({ outcome: "ok", value: [] });
  return {
    load,
    runChecks,
    projectChecks,
    outputPaths,
    port: {
      load,
      run: runChecks,
      project: projectChecks,
      outputPaths,
    },
  };
};

const DETECTED: NamedSettingsReading["eslintConfigLookup"] = { lookup: "detected" };

const enginesRequestOf = (request: {
  readonly selected: NamedSettingsReading["selection"]["selected"];
  readonly lookup: NamedSettingsReading["eslintConfigLookup"];
  readonly engine: NamedEnginePort;
}): NamedEnginesRequest => ({
  checks: [CAST_ENGINE_CHECK],
  settings: settingsBinding(request),
  answered: answeredFilesOf({ records: DEBT_ON_A.records }),
  tree: { tracked: [A, README], declaredConfigRoots: [] },
  repoRoot: REPO,
  installRoot: INSTALL,
  moduleExtension: ".ts",
  path: UNUSED_PATH,
  engine: request.engine,
  modules: MODULES,
});

const ESLINT_RUN_REQUEST: NamedEngineRunRequest = {
  repoRoot: REPO,
  installRoot: INSTALL,
  files: [A],
  trackedPaths: [A, README],
  checks: [CAST_ENGINE_CHECK],
  bindings: [bindingOn({ mechanism: ESLINT })],
  answered: [{ ruleSet: "hone", symptom: "claimed-type", file: A }],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
  projectionKind: "mjs",
  testFiles: { suffixes: ["test", "spec"], folders: [] },
};

const RUNNER_INVALID: Result<ParsedNamedRunner, RunnerInvalid> = {
  outcome: "failed",
  error: { kind: "runner-invalid", mechanism: ESLINT, detail: "Cannot find module" },
};

describe("namedEngineRunsOf", () => {
  it("runs each mechanism the selection binds once, loading its engine from the install", async () => {
    const engine = engineFake();
    engine.load
      .mockResolvedValueOnce({ outcome: "ok", value: AUDIT_LOADED })
      .mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks
      .mockResolvedValueOnce({ outcome: "ok", value: AUDIT_RUN })
      .mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    const run = await namedEngineRunsOf(
      enginesRequestOf({
        selected: [
          selectedOn({ mechanism: AUDIT }),
          selectedOn({ mechanism: ESLINT }),
          selectedOn({ mechanism: AUDIT }),
        ],
        lookup: DETECTED,
        engine: engine.port,
      }),
    );
    expect({ run, loaded: engine.load.mock.calls }).toEqual({
      run: { outcome: "ok", value: [AUDIT_RUN, ESLINT_RUN] },
      loaded: [
        [
          expect.objectContaining({
            mechanism: AUDIT,
            installRoot: INSTALL,
            moduleExtension: ".ts",
            modules: MODULES,
            path: UNUSED_PATH,
          }),
        ],
        [
          expect.objectContaining({
            mechanism: ESLINT,
            installRoot: INSTALL,
            moduleExtension: ".ts",
            modules: MODULES,
            path: UNUSED_PATH,
          }),
        ],
      ],
    });
  });

  it("asks the engine to run its checks with the TypeScript files, the tracked paths, the catalogue's checks, the bindings and the files records answer", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    await namedEngineRunsOf(
      enginesRequestOf({
        selected: [selectedOn({ mechanism: ESLINT })],
        lookup: DETECTED,
        engine: engine.port,
      }),
    );
    expect(engine.runChecks.mock.calls).toEqual([
      [{ mechanism: ESLINT, runner: ESLINT_LOADED, request: ESLINT_RUN_REQUEST }],
    ]);
  });

  it("passes the ESLint config lookup the settings declare, and none when the settings leave it to be detected", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    await namedEngineRunsOf(
      enginesRequestOf({
        selected: [selectedOn({ mechanism: ESLINT })],
        lookup: { lookup: "declared", value: "repository-root" },
        engine: engine.port,
      }),
    );
    expect(engine.runChecks.mock.calls).toEqual([
      [
        {
          mechanism: ESLINT,
          runner: ESLINT_LOADED,
          request: { ...ESLINT_RUN_REQUEST, declaredConfigLookup: "repository-root" },
        },
      ],
    ]);
  });

  it("fails as an invalid runner, naming the mechanism whose runner cannot be loaded", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce(RUNNER_INVALID);
    expect(
      await namedEngineRunsOf(
        enginesRequestOf({
          selected: [selectedOn({ mechanism: ESLINT })],
          lookup: DETECTED,
          engine: engine.port,
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid",
        mechanism: ESLINT,
        detail: "Cannot find module",
      },
    });
  });

  it("fails as an engine that failed, naming the engine, when its runner fails", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.runChecks.mockResolvedValueOnce({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "tool-failed", detail: "ESLint stopped" },
      },
    });
    expect(
      await namedEngineRunsOf(
        enginesRequestOf({
          selected: [selectedOn({ mechanism: ESLINT })],
          lookup: DETECTED,
          engine: engine.port,
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "tool-failed", detail: "ESLint stopped" },
      },
    });
  });

  it("runs nothing when the selection binds no mechanism", async () => {
    const engine = engineFake();
    expect({
      run: await namedEngineRunsOf(
        enginesRequestOf({ selected: [], lookup: DETECTED, engine: engine.port }),
      ),
      loaded: engine.load.mock.calls,
    }).toEqual({ run: { outcome: "ok", value: [] }, loaded: [] });
  });
});

const WRITTEN_PROJECTION = { file: repoPathOf("hone.eslint.mjs"), text: "export default [];\n" };

describe("namedEngineProjectionsOf", () => {
  it("gives the files the checks runner wrote", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "ok", value: [WRITTEN_PROJECTION] });
    expect(
      await namedEngineProjectionsOf(
        enginesRequestOf({
          selected: [selectedOn({ mechanism: ESLINT })],
          lookup: DETECTED,
          engine: engine.port,
        }),
      ),
    ).toEqual({
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
    await namedEngineProjectionsOf(
      enginesRequestOf({
        selected: [selectedOn({ mechanism: ESLINT })],
        lookup: DETECTED,
        engine: engine.port,
      }),
    );
    await namedEngineRunsOf(
      enginesRequestOf({
        selected: [selectedOn({ mechanism: ESLINT })],
        lookup: DETECTED,
        engine: engine.port,
      }),
    );
    expect({
      projected: engine.projectChecks.mock.calls,
      run: engine.runChecks.mock.calls,
    }).toEqual({
      projected: [[{ mechanism: ESLINT, runner: ESLINT_LOADED, request: ESLINT_RUN_REQUEST }]],
      run: [[{ mechanism: ESLINT, runner: ESLINT_LOADED, request: ESLINT_RUN_REQUEST }]],
    });
  });

  it("writes nothing for an engine that projects no file", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: AUDIT_LOADED });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "ok", value: [] });
    expect(
      await namedEngineProjectionsOf(
        enginesRequestOf({
          selected: [selectedOn({ mechanism: AUDIT })],
          lookup: DETECTED,
          engine: engine.port,
        }),
      ),
    ).toEqual({
      outcome: "ok",
      value: [],
    });
  });

  it("writes nothing when the selection binds no mechanism", async () => {
    const engine = engineFake();
    expect({
      projected: await namedEngineProjectionsOf(
        enginesRequestOf({ selected: [], lookup: DETECTED, engine: engine.port }),
      ),
      loaded: engine.load.mock.calls,
    }).toEqual({ projected: { outcome: "ok", value: [] }, loaded: [] });
  });

  it("fails as an invalid runner, naming the mechanism whose runner cannot be loaded", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce(RUNNER_INVALID);
    expect(
      await namedEngineProjectionsOf(
        enginesRequestOf({
          selected: [selectedOn({ mechanism: ESLINT })],
          lookup: DETECTED,
          engine: engine.port,
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid",
        mechanism: ESLINT,
        detail: "Cannot find module",
      },
    });
  });

  it("fails as an engine that failed, naming the engine, when the checks runner fails", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_LOADED });
    engine.projectChecks.mockResolvedValueOnce({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "tool-failed", detail: "disk full" },
      },
    });
    expect(
      await namedEngineProjectionsOf(
        enginesRequestOf({
          selected: [selectedOn({ mechanism: ESLINT })],
          lookup: DETECTED,
          engine: engine.port,
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "tool-failed", detail: "disk full" },
      },
    });
  });
});

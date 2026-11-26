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
import type { ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import { DEFAULT_CONVENTIONS } from "../../../domain/settings/conventions.ts";
import type { LoadedEngine, NamedEnginePort } from "../../ports/engine/engine-port.ts";
import type {
  EngineCheck,
  NamedEngineRun,
  NamedEngineRunRequest,
} from "../../ports/engine/engine-run.ts";
import type { RunnerInvalid } from "../../ports/engine/runner-location.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { NamedSettingsReading } from "../settings/read-settings.ts";
import {
  type NamedEnginesRequest,
  projectNamedEngines,
  runNamedEngines,
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
  const runChecks = vi.fn<LoadedEngine["run"]>();
  const projectChecks = vi
    .fn<LoadedEngine["project"]>()
    .mockResolvedValue({ outcome: "ok", value: [] });
  return {
    load,
    runChecks,
    projectChecks,
    port: { load },
    loaded: { run: runChecks, project: projectChecks },
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
  testFiles: { suffixes: ["test", "spec"], folders: [] },
};

const RUNNER_INVALID: Result<LoadedEngine, RunnerInvalid> = {
  outcome: "failed",
  error: { kind: "runner-invalid", mechanism: ESLINT, detail: "Cannot find module" },
};

describe("runNamedEngines", () => {
  it("runs each mechanism the selection binds once, loading its engine from the install", async () => {
    const audit = vi
      .fn<LoadedEngine["run"]>()
      .mockResolvedValue({ outcome: "ok", value: AUDIT_RUN });
    const eslint = vi
      .fn<LoadedEngine["run"]>()
      .mockResolvedValue({ outcome: "ok", value: ESLINT_RUN });
    const load = vi
      .fn<NamedEnginePort["load"]>()
      .mockResolvedValueOnce({
        outcome: "ok",
        value: { run: audit, project: async () => ({ outcome: "ok", value: [] }) },
      })
      .mockResolvedValueOnce({
        outcome: "ok",
        value: { run: eslint, project: async () => ({ outcome: "ok", value: [] }) },
      });

    const run = await runNamedEngines(
      enginesRequestOf({
        selected: [
          selectedOn({ mechanism: AUDIT }),
          selectedOn({ mechanism: ESLINT }),
          selectedOn({ mechanism: AUDIT }),
        ],
        lookup: DETECTED,
        engine: { load },
      }),
    );
    expect(audit).toHaveBeenCalledTimes(1);
    expect(eslint).toHaveBeenCalledTimes(1);
    expect({ run, loaded: load.mock.calls }).toEqual({
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
            projectionKind: "mjs",
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
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: engine.loaded });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    await runNamedEngines(
      enginesRequestOf({
        selected: [selectedOn({ mechanism: ESLINT })],
        lookup: DETECTED,
        engine: engine.port,
      }),
    );
    expect(engine.runChecks.mock.calls).toEqual([[ESLINT_RUN_REQUEST]]);
  });

  it("projects the full request and runs the engine with projected paths removed", async () => {
    const file = repoPathOf("hone.eslint.d.mts");
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: engine.loaded });
    engine.projectChecks.mockResolvedValueOnce({
      outcome: "ok",
      value: [{ kind: "write", file, text: "export {};" }],
    });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    const request = enginesRequestOf({
      selected: [selectedOn({ mechanism: ESLINT })],
      lookup: DETECTED,
      engine: engine.port,
    });

    const run = await runNamedEngines({
      ...request,
      tree: { tracked: [A, README, file], declaredConfigRoots: [] },
    });

    expect(run).toEqual({
      outcome: "ok",
      value: [{ ...ESLINT_RUN, comparedOutputs: [repoPathOf("hone.eslint.d.mts")] }],
    });
    expect(engine.projectChecks).toHaveBeenCalledExactlyOnceWith({
      ...ESLINT_RUN_REQUEST,
      files: [A, file],
      trackedPaths: [A, README, file],
    });
    expect(engine.runChecks).toHaveBeenCalledExactlyOnceWith(ESLINT_RUN_REQUEST);
  });

  it("passes the ESLint config lookup the settings declare, and none when the settings leave it to be detected", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: engine.loaded });
    engine.runChecks.mockResolvedValueOnce({ outcome: "ok", value: ESLINT_RUN });
    await runNamedEngines(
      enginesRequestOf({
        selected: [selectedOn({ mechanism: ESLINT })],
        lookup: { lookup: "declared", value: "repository-root" },
        engine: engine.port,
      }),
    );
    expect(engine.runChecks.mock.calls).toEqual([
      [{ ...ESLINT_RUN_REQUEST, declaredConfigLookup: "repository-root" }],
    ]);
  });

  it("fails as an invalid runner, naming the mechanism whose runner cannot be loaded", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce(RUNNER_INVALID);
    expect(
      await runNamedEngines(
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
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: engine.loaded });
    engine.runChecks.mockResolvedValueOnce({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "tool-failed", detail: "ESLint stopped" },
      },
    });
    expect(
      await runNamedEngines(
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
      run: await runNamedEngines(
        enginesRequestOf({ selected: [], lookup: DETECTED, engine: engine.port }),
      ),
      loaded: engine.load.mock.calls,
    }).toEqual({ run: { outcome: "ok", value: [] }, loaded: [] });
  });
});

const WRITTEN_PROJECTION: ProjectedFile = {
  kind: "write",
  file: repoPathOf("hone.eslint.mjs"),
  text: "export default [];\n",
};

describe("projectNamedEngines", () => {
  it("gives the files the checks runner wrote", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: engine.loaded });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "ok", value: [WRITTEN_PROJECTION] });
    expect(
      await projectNamedEngines(
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

  it("writes nothing for an engine that projects no file", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: engine.loaded });
    engine.projectChecks.mockResolvedValueOnce({ outcome: "ok", value: [] });
    expect(
      await projectNamedEngines(
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
      projected: await projectNamedEngines(
        enginesRequestOf({ selected: [], lookup: DETECTED, engine: engine.port }),
      ),
      loaded: engine.load.mock.calls,
    }).toEqual({ projected: { outcome: "ok", value: [] }, loaded: [] });
  });

  it("fails as an invalid runner, naming the mechanism whose runner cannot be loaded", async () => {
    const engine = engineFake();
    engine.load.mockResolvedValueOnce(RUNNER_INVALID);
    expect(
      await projectNamedEngines(
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
    engine.load.mockResolvedValueOnce({ outcome: "ok", value: engine.loaded });
    engine.projectChecks.mockResolvedValueOnce({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "tool-failed", detail: "disk full" },
      },
    });
    expect(
      await projectNamedEngines(
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

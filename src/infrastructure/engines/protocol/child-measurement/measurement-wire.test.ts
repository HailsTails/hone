import { describe, expect, it, vi } from "vitest";

import type { ProcessPort } from "../../../../application/ports/host/process-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import {
  createMeasurementArguments,
  decodeMeasuredRuns,
  type MeasureEngines,
  runEnginesMeasurement,
} from "./measurement-wire.ts";

describe("createMeasurementArguments", () => {
  it("passes the install root and the repository root when no base revision was given", () => {
    const measured = createMeasurementArguments({
      installRoot: absoluteRootOf("/install"),
      repoRoot: absoluteRootOf("/repo"),
      baseRevision: undefined,
    });

    expect(measured).toEqual(["/install", "/repo"]);
  });

  it("passes the base revision after the roots", () => {
    const measured = createMeasurementArguments({
      installRoot: absoluteRootOf("/install"),
      repoRoot: absoluteRootOf("/repo"),
      baseRevision: "origin/main",
    });

    expect(measured).toEqual(["/install", "/repo", "origin/main"]);
  });
});

describe("runEnginesMeasurement", () => {
  it("measures over the roots and base revision it was given, writing each engine's kinds and report", async () => {
    const measure = vi.fn<MeasureEngines>().mockResolvedValue({
      outcome: "ok",
      value: [
        {
          mechanism: "eslint",
          coverableKinds: ["inline-disable"],
          projection: "current",
          slices: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          hits: [],
          nativeExceptions: [
            {
              kind: "config-override",
              check: "claimed-type#non-null-assertions",
              file: repoPathOf("src/a.ts"),
            },
          ],
          measured: [{ check: "claimed-type#non-null-assertions", file: repoPathOf("src/a.ts") }],
        },
      ],
    });
    const process: ProcessPort = {
      arguments: ["/install", "/repo", "origin/main"],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };

    await runEnginesMeasurement({ process, measure });

    expect({
      measuring: measure.mock.calls,
      written: vi.mocked(process.writeOut).mock.calls,
      errors: vi.mocked(process.writeError).mock.calls,
      exits: vi.mocked(process.exitWith).mock.calls,
    }).toEqual({
      measuring: [
        [
          {
            installRoot: absoluteRootOf("/install"),
            repoRoot: absoluteRootOf("/repo"),
            baseRevision: "origin/main",
          },
        ],
      ],
      written: [
        [
          {
            text: '{"outcome":"measured","engines":{"eslint":{"coverableKinds":["inline-disable"],"result":{"outcome":"ok","value":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[{"kind":"config-override","check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"projection":"current"}}}}}',
          },
        ],
      ],
      errors: [],
      exits: [],
    });
  });

  it("measures over the roots alone when no base revision was given", async () => {
    const measure = vi.fn<MeasureEngines>().mockResolvedValue({ outcome: "ok", value: [] });
    const process: ProcessPort = {
      arguments: ["/install", "/repo"],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };

    await runEnginesMeasurement({ process, measure });

    expect({
      measuring: measure.mock.calls,
      written: vi.mocked(process.writeOut).mock.calls,
    }).toEqual({
      measuring: [
        [
          {
            installRoot: absoluteRootOf("/install"),
            repoRoot: absoluteRootOf("/repo"),
            baseRevision: undefined,
          },
        ],
      ],
      written: [[{ text: '{"outcome":"measured","engines":{}}' }]],
    });
  });

  it("writes the run's load failure with its kind", async () => {
    const measure = vi.fn<MeasureEngines>().mockResolvedValue({
      outcome: "failed",
      error: {
        kind: "engine-failed",
        engine: { named: "engine", engine: { name: "eslint" } },
        failure: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" },
      },
    });
    const process: ProcessPort = {
      arguments: ["/install", "/repo"],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };

    await runEnginesMeasurement({ process, measure });

    expect({
      written: vi.mocked(process.writeOut).mock.calls,
      errors: vi.mocked(process.writeError).mock.calls,
      exits: vi.mocked(process.exitWith).mock.calls,
    }).toEqual({
      written: [
        [
          {
            text: '{"outcome":"not-loaded","failure":{"kind":"engine-failed","engine":{"named":"engine","engine":{"name":"eslint"}},"failure":{"kind":"team-config-unloadable","detail":"eslint.config.mjs threw"}}}',
          },
        ],
      ],
      errors: [],
      exits: [],
    });
  });

  it("writes invalid arguments as the run's load failure, and measures nothing", async () => {
    const measure = vi.fn<MeasureEngines>();
    const process: ProcessPort = {
      arguments: ["/install", "repo"],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };

    await runEnginesMeasurement({ process, measure });

    expect({
      measuring: measure.mock.calls,
      written: vi.mocked(process.writeOut).mock.calls,
    }).toEqual({
      measuring: [],
      written: [
        [
          {
            text: expect.stringMatching(
              /^\{"outcome":"not-loaded","failure":\{"kind":"arguments-invalid","detail":".+"\}\}$/,
            ),
          },
        ],
      ],
    });
  });
});

describe("decodeMeasuredRuns", () => {
  it("reads each engine's kinds and report back as its run", () => {
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      stdout:
        '{"outcome":"measured","engines":{"eslint":{"coverableKinds":["config-override","inline-disable"],"result":{"outcome":"ok","value":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[{"kind":"config-override","check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"projection":"out-of-date"}}}}}',
    });

    expect(runs).toEqual({
      outcome: "ok",
      value: [
        {
          mechanism: "eslint",
          coverableKinds: ["config-override", "inline-disable"],
          slices: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          hits: [],
          nativeExceptions: [
            {
              kind: "config-override",
              check: "claimed-type#non-null-assertions",
              file: repoPathOf("src/a.ts"),
            },
          ],
          measured: [{ check: "claimed-type#non-null-assertions", file: repoPathOf("src/a.ts") }],
          projection: "out-of-date",
        },
      ],
    });
  });

  it("keeps the kind of a load failure that decodes, whatever the exit status", () => {
    const runs = decodeMeasuredRuns({
      status: 2,
      stderr: "warning: slow disk",
      stdout:
        '{"outcome":"not-loaded","failure":{"kind":"listed-under-both-names","path":"hone.config.json","under":"checks","from":"a#b","to":"a#c"}}',
    });

    expect(runs).toEqual({
      outcome: "failed",
      error: {
        kind: "listed-under-both-names",
        path: "hone.config.json",
        under: "checks",
        from: "a#b",
        to: "a#c",
      },
    });
  });

  it("fails the engine whose entry does not decode as its runner giving invalid output", () => {
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      stdout: '{"outcome":"measured","engines":{"eslint":{"coverableKinds":[]}}}',
    });

    expect(runs).toEqual({
      outcome: "failed",
      error: {
        kind: "engine-failed",
        engine: { named: "mechanism", mechanism: "eslint" },
        failure: { kind: "runner-invalid-output", detail: expect.any(String) },
      },
    });
  });

  it("fails the engine with the runner failure its entry carries", () => {
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      stdout:
        '{"outcome":"measured","engines":{"eslint":{"coverableKinds":[],"result":{"outcome":"failed","error":{"kind":"team-config-unloadable","detail":"eslint.config.mjs threw"}}}}}',
    });

    expect(runs).toEqual({
      outcome: "failed",
      error: {
        kind: "engine-failed",
        engine: { named: "mechanism", mechanism: "eslint" },
        failure: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" },
      },
    });
  });

  it("fails as an unexpected error naming the exit status and error output when the reply is not JSON", () => {
    const runs = decodeMeasuredRuns({ status: 1, stderr: "TypeError: boom", stdout: "" });

    expect(runs).toEqual({
      outcome: "failed",
      error: {
        kind: "unexpected-error",
        detail: expect.stringMatching(
          /^the measurement reply could not be decoded \(exit status 1\): .+; error output: TypeError: boom$/,
        ),
      },
    });
  });

  it("fails as an unexpected error when the reply is JSON but no measurement reply", () => {
    const runs = decodeMeasuredRuns({ status: 0, stderr: "", stdout: '{"outcome":"finished"}' });

    expect(runs).toEqual({
      outcome: "failed",
      error: {
        kind: "unexpected-error",
        detail: expect.stringMatching(
          /^the measurement reply could not be decoded \(exit status 0\): .+; error output: $/s,
        ),
      },
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import type { NamedEngineRun } from "../../../../application/ports/engine/engine-run.ts";
import type { ReplyPort } from "../../../../application/ports/host/reply-port.ts";
import type { RequestPort } from "../../../../application/ports/host/request-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import {
  createMeasurementArguments,
  createMeasurementInput,
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

describe("createMeasurementInput", () => {
  it("writes the tree as JSON", () => {
    const input = createMeasurementInput({
      tree: {
        tracked: [repoPathOf("src/a.ts"), repoPathOf("hone.eslint.d.mts")],
        declaredConfigRoots: [repoPathOf("packages/a")],
      },
    });

    expect(input).toBe(
      '{"tracked":["src/a.ts","hone.eslint.d.mts"],"declaredConfigRoots":["packages/a"]}',
    );
  });
});

const MEASURED_WITH_APPLICABILITY: NamedEngineRun = {
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
  coverage: {
    kind: "scoped",
    candidateFiles: [repoPathOf("src/a.ts"), repoPathOf("hone.eslint.d.mts")],
    inapplicable: [
      { check: "claimed-type#non-null-assertions", file: repoPathOf("hone.eslint.d.mts") },
    ],
  },
  comparedOutputs: [],
};

describe("runEnginesMeasurement", () => {
  it("measures over the roots, base revision and tree it was given, files the repository does not track included, replying with each engine's run", async () => {
    const measure = vi.fn<MeasureEngines>().mockResolvedValue({
      outcome: "ok",
      value: [MEASURED_WITH_APPLICABILITY],
    });
    const request: RequestPort = {
      read: vi
        .fn<RequestPort["read"]>()
        .mockReturnValue(
          '{"tracked":["src/a.ts","hone.eslint.d.mts"],"declaredConfigRoots":["packages/a"]}',
        ),
    };
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({
      process: { arguments: ["/install", "/repo", "origin/main"] },
      request,
      reply,
      measure,
    });

    expect({
      measuring: measure.mock.calls,
      replied: vi.mocked(reply.write).mock.calls,
    }).toEqual({
      measuring: [
        [
          {
            installRoot: absoluteRootOf("/install"),
            repoRoot: absoluteRootOf("/repo"),
            baseRevision: "origin/main",
            tree: {
              tracked: [repoPathOf("src/a.ts"), repoPathOf("hone.eslint.d.mts")],
              declaredConfigRoots: [repoPathOf("packages/a")],
            },
          },
        ],
      ],
      replied: [
        [
          {
            text: '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":["inline-disable"],"report":{"projection":"current","slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[{"kind":"config-override","check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}]}}]}',
          },
        ],
      ],
    });
  });

  it("measures over the roots alone when no base revision was given", async () => {
    const measure = vi.fn<MeasureEngines>().mockResolvedValue({ outcome: "ok", value: [] });
    const request: RequestPort = {
      read: vi.fn<RequestPort["read"]>().mockReturnValue('{"tracked":[],"declaredConfigRoots":[]}'),
    };
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({
      process: { arguments: ["/install", "/repo"] },
      request,
      reply,
      measure,
    });

    expect({
      measuring: measure.mock.calls,
      replied: vi.mocked(reply.write).mock.calls,
    }).toEqual({
      measuring: [
        [
          {
            installRoot: absoluteRootOf("/install"),
            repoRoot: absoluteRootOf("/repo"),
            baseRevision: undefined,
            tree: { tracked: [], declaredConfigRoots: [] },
          },
        ],
      ],
      replied: [[{ text: '{"outcome":"measured","runs":[]}' }]],
    });
  });

  it("replies with the run's load failure and its kind", async () => {
    const measure = vi.fn<MeasureEngines>().mockResolvedValue({
      outcome: "failed",
      error: {
        kind: "engine-failed",
        engine: { named: "engine", engine: { name: "eslint" } },
        failure: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" },
      },
    });
    const request: RequestPort = {
      read: vi.fn<RequestPort["read"]>().mockReturnValue('{"tracked":[],"declaredConfigRoots":[]}'),
    };
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({
      process: { arguments: ["/install", "/repo"] },
      request,
      reply,
      measure,
    });

    expect(vi.mocked(reply.write).mock.calls).toEqual([
      [
        {
          text: '{"outcome":"not-loaded","failure":{"kind":"engine-failed","engine":{"named":"engine","engine":{"name":"eslint"}},"failure":{"kind":"team-config-unloadable","detail":"eslint.config.mjs threw"}}}',
        },
      ],
    ]);
  });

  it("replies with invalid arguments as the run's load failure, and measures nothing", async () => {
    const measure = vi.fn<MeasureEngines>();
    const request: RequestPort = {
      read: vi.fn<RequestPort["read"]>().mockReturnValue('{"tracked":[],"declaredConfigRoots":[]}'),
    };
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({
      process: { arguments: ["/install", "repo"] },
      request,
      reply,
      measure,
    });

    expect({
      measuring: measure.mock.calls,
      replied: vi.mocked(reply.write).mock.calls,
    }).toEqual({
      measuring: [],
      replied: [
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

describe("runEnginesMeasurement over a tree that does not parse", () => {
  it.each([
    { name: "it is not JSON", input: "" },
    { name: "it is no tree", input: '{"tracked":["../outside.ts"],"declaredConfigRoots":[]}' },
  ])("replies with invalid arguments, and measures nothing, when $name", async ({ input }) => {
    const measure = vi.fn<MeasureEngines>();
    const request: RequestPort = { read: vi.fn<RequestPort["read"]>().mockReturnValue(input) };
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({
      process: { arguments: ["/install", "/repo"] },
      request,
      reply,
      measure,
    });

    expect({
      measuring: measure.mock.calls,
      replied: vi.mocked(reply.write).mock.calls,
    }).toEqual({
      measuring: [],
      replied: [
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
  it("reads the engine's projection file, compared outputs and measurements", () => {
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      reply:
        '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":["config-override","inline-disable"],"report":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[{"kind":"config-override","check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"projection":"out-of-date","projectionFile":"hone.eslint.ts"},"comparedOutputs":["hone.eslint.ts","hone.eslint.d.mts"]}]}',
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
          projectionFile: repoPathOf("hone.eslint.ts"),
          coverage: { kind: "scope-unavailable" },
          comparedOutputs: [repoPathOf("hone.eslint.ts"), repoPathOf("hone.eslint.d.mts")],
        },
      ],
    });
  });

  it("replies with the runs measured, eslint before walker", async () => {
    const eslintRun: NamedEngineRun = {
      mechanism: "eslint",
      coverableKinds: ["inline-disable"],
      projection: "current-with-file",
      projectionFile: repoPathOf("hone.eslint.mjs"),
      coverage: { kind: "scoped", candidateFiles: [], inapplicable: [] },
      comparedOutputs: [],
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
      hits: [],
      nativeExceptions: [],
      measured: [],
    };
    const walkerRun: NamedEngineRun = {
      mechanism: "walker",
      coverableKinds: [],
      projection: "none",
      coverage: { kind: "scoped", candidateFiles: [], inapplicable: [] },
      comparedOutputs: [],
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
      hits: [],
      nativeExceptions: [],
      measured: [{ check: "claimed-type#non-null-assertions", file: repoPathOf("src/a.ts") }],
    };
    const measure = vi
      .fn<MeasureEngines>()
      .mockResolvedValue({ outcome: "ok", value: [eslintRun, walkerRun] });
    const request: RequestPort = {
      read: vi.fn<RequestPort["read"]>().mockReturnValue('{"tracked":[],"declaredConfigRoots":[]}'),
    };
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({
      process: { arguments: ["/install", "/repo"] },
      request,
      reply,
      measure,
    });

    expect(vi.mocked(reply.write).mock.calls).toEqual([
      [
        {
          text: '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":["inline-disable"],"report":{"projection":"current","projectionFile":"hone.eslint.mjs","slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[],"measured":[]}},{"mechanism":"walker","coverableKinds":[],"report":{"projection":"none","slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}]}}]}',
        },
      ],
    ]);
  });

  it("decodes the runs of a reply in the order written, eslint before walker", () => {
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      reply:
        '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":["inline-disable"],"report":{"projection":"current","projectionFile":"hone.eslint.mjs","slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[],"measured":[]}},{"mechanism":"walker","coverableKinds":[],"report":{"projection":"none","slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}]}}]}',
    });

    expect(runs).toEqual({
      outcome: "ok",
      value: [
        {
          mechanism: "eslint",
          coverableKinds: ["inline-disable"],
          projection: "current-with-file",
          projectionFile: repoPathOf("hone.eslint.mjs"),
          coverage: { kind: "scope-unavailable" },
          comparedOutputs: [],
          slices: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          hits: [],
          nativeExceptions: [],
          measured: [],
        },
        {
          mechanism: "walker",
          coverableKinds: [],
          projection: "none",
          coverage: { kind: "scope-unavailable" },
          comparedOutputs: [],
          slices: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
          hits: [],
          nativeExceptions: [],
          measured: [{ check: "claimed-type#non-null-assertions", file: repoPathOf("src/a.ts") }],
        },
      ],
    });
  });

  it("keeps the kind of a load failure that decodes, whatever the exit status", () => {
    const runs = decodeMeasuredRuns({
      status: 2,
      stderr: "warning: slow disk",
      reply:
        '{"outcome":"not-loaded","failure":{"kind":"upgrade-needed","path":"disciplines.json"}}',
    });

    expect(runs).toEqual({
      outcome: "failed",
      error: {
        kind: "upgrade-needed",
        path: "disciplines.json",
      },
    });
  });

  it("fails as an unexpected error when a run carries a failed result in place of its report", () => {
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      reply:
        '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":[],"report":{"outcome":"failed","error":{"kind":"team-config-unloadable","detail":"eslint.config.mjs threw"}}}]}',
    });

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

  it("fails as an unexpected error naming the exit status and error output when the reply is not JSON", () => {
    const runs = decodeMeasuredRuns({
      status: 1,
      stderr: "TypeError: boom",
      reply: "",
    });

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
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      reply: '{"outcome":"finished"}',
    });

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

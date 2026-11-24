import { describe, expect, it, vi } from "vitest";

import type { NamedEngineRun } from "../../../../application/ports/engine/engine-run.ts";
import type { ReplyPort } from "../../../../application/ports/host/reply-port.ts";
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
  it("measures over the roots and base revision it was given, replying with each engine's run", async () => {
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
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({
      process: { arguments: ["/install", "/repo", "origin/main"] },
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
          },
        ],
      ],
      replied: [
        [
          {
            text: '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":["inline-disable"],"report":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[{"kind":"config-override","check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"projection":"current"}}]}',
          },
        ],
      ],
    });
  });

  it("measures over the roots alone when no base revision was given", async () => {
    const measure = vi.fn<MeasureEngines>().mockResolvedValue({ outcome: "ok", value: [] });
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({ process: { arguments: ["/install", "/repo"] }, reply, measure });

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
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({ process: { arguments: ["/install", "/repo"] }, reply, measure });

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
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({ process: { arguments: ["/install", "repo"] }, reply, measure });

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
  it("reads each engine's kinds and report back as its run", () => {
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      reply:
        '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":["config-override","inline-disable"],"report":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[{"kind":"config-override","check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"projection":"out-of-date"}}]}',
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

  it("replies with the runs measured, eslint before walker", async () => {
    const eslintRun: NamedEngineRun = {
      mechanism: "eslint",
      coverableKinds: ["inline-disable"],
      projection: "current",
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
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runEnginesMeasurement({ process: { arguments: ["/install", "/repo"] }, reply, measure });

    expect(vi.mocked(reply.write).mock.calls).toEqual([
      [
        {
          text: '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":["inline-disable"],"report":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[],"measured":[],"projection":"current"}},{"mechanism":"walker","coverableKinds":[],"report":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"projection":"none"}}]}',
        },
      ],
    ]);
  });

  it("decodes the runs of a reply in the order written, eslint before walker", () => {
    const runs = decodeMeasuredRuns({
      status: 0,
      stderr: "",
      reply:
        '{"outcome":"measured","runs":[{"mechanism":"eslint","coverableKinds":["inline-disable"],"report":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[],"measured":[],"projection":"current"}},{"mechanism":"walker","coverableKinds":[],"report":{"slices":[],"nestedConfigurations":[],"unprojectedFolders":[],"misnamedRuleIds":[],"hits":[],"nativeExceptions":[],"measured":[{"check":"claimed-type#non-null-assertions","file":"src/a.ts"}],"projection":"none"}}]}',
    });

    expect(runs).toEqual({
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
          nativeExceptions: [],
          measured: [],
        },
        {
          mechanism: "walker",
          coverableKinds: [],
          projection: "none",
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
    const runs = decodeMeasuredRuns({ status: 1, stderr: "TypeError: boom", reply: "" });

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
    const runs = decodeMeasuredRuns({ status: 0, stderr: "", reply: '{"outcome":"finished"}' });

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

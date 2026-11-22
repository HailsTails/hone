import { describe, expect, it, vi } from "vitest";
import type { LoadedRunner } from "../ports/engine/runner-module.ts";
import type { LoadedEngine } from "../ports/engine/engine-run.ts";
import { conformingRunnerOf } from "./conforming-runner.ts";

const MECHANISM = "eslint" as const;

const standalone = (): Extract<LoadedRunner, { readonly exceptionPath: "standalone" }> => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
});

const embedded = (): Extract<LoadedRunner, { readonly exceptionPath: "embedded" }> => ({
  exceptionPath: "embedded",
  projectedKinds: [],
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
  project: vi.fn<LoadedRunner["run"]>(),
});

const checksRunner = (): NonNullable<LoadedEngine["checksRunner"]> => ({
  projectedKinds: [],
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
  project: vi.fn<LoadedRunner["run"]>(),
});

describe("conformingRunnerOf", () => {
  it("gives a standalone engine's runner, ahead of a checks runner beside it", () => {
    const runner = standalone();
    expect(conformingRunnerOf({ engine: { mechanism: MECHANISM, runner, checksRunner: checksRunner() } })).toEqual({ outcome: "ok", value: runner });
  });

  it("gives the checks runner of an engine that runs through a native tool, not the runner export beside it", () => {
    const checks = checksRunner();
    expect(conformingRunnerOf({ engine: { mechanism: MECHANISM, runner: embedded(), checksRunner: checks } })).toEqual({ outcome: "ok", value: checks });
  });

  it("is runner-unloadable, in the words conformance needs, for an engine that runs through a native tool and exports no checks runner", () => {
    expect(conformingRunnerOf({ engine: { mechanism: MECHANISM, runner: embedded(), checksRunner: undefined } })).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-unloadable",
        detail: "the runner module exports no checksRunner, which version 2 conformance needs of an engine that runs through a native tool",
      },
    });
  });
});

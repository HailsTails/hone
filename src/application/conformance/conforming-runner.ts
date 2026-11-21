import type { LoadedRunner } from "../ports/engine/runner-module.ts";
import type { LoadedEngine } from "../../infrastructure/engines/protocol/engine-run/engine-run.ts";
import type { Result } from "../../domain/result.ts";
import type { ConformanceSetupFailure } from "./conformance-testing-types.ts";

export type ConformingRunner = Pick<LoadedRunner, "conform">;

export const NO_CHECKS_RUNNER_FOR_CONFORMANCE_DETAIL =
  "the runner module exports no checksRunner, which version 2 conformance needs of an engine that runs through a native tool";

export const conformingRunnerOf = (request: { readonly engine: LoadedEngine }): Result<ConformingRunner, ConformanceSetupFailure> => {
  const { runner, checksRunner } = request.engine;
  if (runner.exceptionPath === "standalone") {
    return { outcome: "ok", value: runner };
  }
  return checksRunner === undefined
    ? { outcome: "failed", error: { kind: "runner-unloadable", detail: NO_CHECKS_RUNNER_FOR_CONFORMANCE_DETAIL } }
    : { outcome: "ok", value: checksRunner };
};

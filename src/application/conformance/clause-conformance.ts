import { loadFailureDetail } from "../../infrastructure/printed-report/load-failures/load-failure-text.ts";
import type { RunnerLocation } from "../../infrastructure/engines/protocol/engine-run/load-runner.ts";
import { loadedEngineOf } from "../../infrastructure/engines/protocol/engine-run/engine-run.ts";
import type { Result } from "../../domain/result.ts";
import { boundClauseOf, type RuleSetReading } from "./clause-under-test.ts";
import { checkConformance } from "../../infrastructure/engines/protocol/conformance.ts";
import { conformingRunnerOf } from "./conforming-runner.ts";
import { editionRunsOf } from "./edition-runs.ts";
import { gatheredOutcomes } from "../../domain/gathered-outcomes.ts";
import type { ClauseRequest, ConformanceFailure, ConformanceSetupFailure } from "./conformance-testing-types.ts";

export type ClauseConformanceRequest = RuleSetReading & Omit<RunnerLocation, "mechanism" | "path"> & ClauseRequest;

export const clauseConformanceOf = async (
  request: ClauseConformanceRequest,
): Promise<Result<readonly ConformanceFailure[], ConformanceSetupFailure>> => {
  const bound = boundClauseOf(request);
  if (bound.outcome === "failed") {
    return bound;
  }
  const engine = await loadedEngineOf(request);
  if (engine.outcome === "failed") {
    return { outcome: "failed", error: { kind: "runner-unloadable", detail: loadFailureDetail({ failure: engine.error }) } };
  }
  const runner = conformingRunnerOf({ engine: engine.value });
  if (runner.outcome === "failed") {
    return runner;
  }
  const conformance = gatheredOutcomes({
    outcomes: await Promise.all(
      editionRunsOf(bound.value).map((run) => checkConformance({ clause: run.clause, cases: run.cases, runner: runner.value })),
    ),
  });
  return conformance.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "runner-refused",
          detail: loadFailureDetail({ failure: { kind: "runner-failed", mechanism: request.mechanism, failure: conformance.error } }),
        },
      }
    : conformance;
};

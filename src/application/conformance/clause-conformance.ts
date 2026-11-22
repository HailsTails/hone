import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { RunnerLocation } from "../ports/engine/runner-location.ts";
import type { EnginePort } from "../ports/engine/engine-port.ts";
import type { Result } from "../../domain/result.ts";
import { boundClauseOf, type BoundClause, type RuleSetReading } from "./clause-under-test.ts";
import { conformingRunnerOf } from "./conforming-runner.ts";
import { editionRunsOf } from "../../domain/runner/edition-runs.ts";
import { gatheredOutcomes } from "../../domain/gathered-outcomes.ts";
import type { ClauseRequest, ConformanceFailure, ConformanceSetupFailure } from "./conformance-testing-types.ts";

export type ClauseConformanceRequest = RuleSetReading & Omit<RunnerLocation, "mechanism" | "path"> & ClauseRequest & { readonly engine: EnginePort };

export const clauseConformanceOf = async (
  request: ClauseConformanceRequest,
): Promise<Result<readonly ConformanceFailure[], ConformanceSetupFailure>> => {
  const bound = boundClauseOf(request);
  if (bound.outcome === "failed") {
    return bound;
  }
  return conformBoundClause({ location: request, engine: request.engine, loadFailureDetail: request.loadFailureDetail, bound: bound.value });
};

export const conformBoundClause = async (
  request: { readonly location: RunnerLocation; readonly engine: EnginePort; readonly bound: BoundClause; readonly loadFailureDetail: LoadFailureDetail },
): Promise<Result<readonly ConformanceFailure[], ConformanceSetupFailure>> => {
  const engine = await request.engine.load(request.location);
  if (engine.outcome === "failed") {
    return { outcome: "failed", error: { kind: "runner-unloadable", detail: request.loadFailureDetail({ failure: engine.error }) } };
  }
  const runner = conformingRunnerOf({ engine: engine.value });
  if (runner.outcome === "failed") {
    return runner;
  }
  const conformance = gatheredOutcomes({
    outcomes: await Promise.all(
      editionRunsOf(request.bound).map((run) => request.engine.conform({ clause: run.clause, cases: run.cases, runner: runner.value })),
    ),
  });
  return conformance.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "runner-refused",
          detail: request.loadFailureDetail({ failure: { kind: "runner-failed", mechanism: request.location.mechanism, failure: conformance.error } }),
        },
      }
    : conformance;
};

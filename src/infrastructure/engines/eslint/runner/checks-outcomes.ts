import type { Result } from "../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

export const mappedOutcome = <Value, Mapped>(request: {
  readonly outcome: Outcome<Value>;
  readonly map: (okValue: Value) => Mapped;
}): Outcome<Mapped> =>
  request.outcome.outcome === "failed"
    ? request.outcome
    : { outcome: "ok", value: request.map(request.outcome.value) };

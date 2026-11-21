import type { Result } from "./result.ts";

export const gatheredOutcomes = <Value, Failure>(request: {
  readonly outcomes: readonly Result<readonly Value[], Failure>[];
}): Result<readonly Value[], Failure> => {
  const failed = request.outcomes.find((outcome) => outcome.outcome === "failed");
  if (failed !== undefined) return failed;
  return {
    outcome: "ok",
    value: request.outcomes.flatMap((outcome) => (outcome.outcome === "ok" ? outcome.value : [])),
  };
};

export const listedOutcome = <Value, Failure>(request: {
  readonly outcome: Result<Value, Failure>;
}): Result<readonly Value[], Failure> =>
  request.outcome.outcome === "failed" ? request.outcome : { outcome: "ok", value: [request.outcome.value] };

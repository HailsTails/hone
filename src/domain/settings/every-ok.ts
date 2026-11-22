import type { Result } from "../result.ts";

export const everyOk = <Entry, Resolved, Failure>(request: {
  readonly entries: readonly Entry[];
  readonly resolve: (entry: Entry) => Result<Resolved, Failure>;
}): Result<readonly Resolved[], Failure> =>
  request.entries.reduce<Result<readonly Resolved[], Failure>>(
    (sofar, entry) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const resolved = request.resolve(entry);
      return resolved.outcome === "failed"
        ? resolved
        : { outcome: "ok", value: [...sofar.value, resolved.value] };
    },
    { outcome: "ok", value: [] },
  );

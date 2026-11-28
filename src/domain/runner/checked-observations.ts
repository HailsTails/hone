import { gatheredOutcomes, listedOutcome } from "../gathered-outcomes.ts";
import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { Result } from "../result.ts";
import type { CheckBinding } from "./check-binding.ts";
import type {
  BoundCheckException,
  BoundCheckHit,
  CheckHit,
  CheckMeasurement,
  CheckNativeException,
} from "./check-observations.ts";
import { type RunnerFailure, runnerInvalidOutput } from "./runner-failure.ts";

type CheckObservations = {
  readonly hits: readonly CheckHit[];
  readonly measured: readonly CheckMeasurement[];
  readonly inapplicable: readonly CheckMeasurement[];
  readonly nativeExceptions: readonly CheckNativeException[];
};

type ObservationRequest = {
  readonly files: readonly RepoPath[];
  readonly bindings: readonly CheckBinding[];
};

const unrequestedFileDetail = (request: {
  readonly kind: string;
  readonly entries: readonly CheckMeasurement[];
  readonly checks: ReadonlyMap<CheckAddressText, CheckBinding>;
  readonly files: ReadonlySet<RepoPath>;
}): string | undefined => {
  const entry = request.entries.find(
    ({ check, file }) => !request.checks.has(check) || !request.files.has(file),
  );
  return entry === undefined
    ? undefined
    : `${request.kind} names ${entry.check} in ${entry.file}, which the request did not hold`;
};

type RequestedChecks = {
  readonly checks: ReadonlyMap<CheckAddressText, CheckBinding>;
  readonly files: ReadonlySet<RepoPath>;
};

type BoundObservations = Omit<CheckObservations, "hits" | "nativeExceptions"> & {
  readonly hits: readonly BoundCheckHit[];
  readonly nativeExceptions: readonly BoundCheckException[];
};

const bindHit = (
  request: RequestedChecks & { readonly hit: CheckHit },
): Result<BoundCheckHit, RunnerFailure> => {
  const { hit } = request;
  const binding = request.checks.get(hit.check);
  return binding === undefined || !request.files.has(hit.file)
    ? runnerInvalidOutput({
        detail: `a hit names ${hit.check} in ${hit.file}, which the request did not hold`,
      })
    : { outcome: "ok", value: { ...hit, ruleSet: binding.ruleSet } };
};

const bindException = (
  request: Pick<RequestedChecks, "checks"> & { readonly exception: CheckNativeException },
): Result<BoundCheckException, RunnerFailure> => {
  const { exception } = request;
  const binding = request.checks.get(exception.check);
  return binding === undefined
    ? runnerInvalidOutput({
        detail: `a native exception names ${exception.check}, which the request did not hold`,
      })
    : { outcome: "ok", value: { ...exception, ruleSet: binding.ruleSet } };
};

export const checkedObservations = (request: {
  readonly requested: ObservationRequest;
  readonly report: CheckObservations;
}): Result<BoundObservations, RunnerFailure> => {
  const { requested, report } = request;
  const checks = new Map(requested.bindings.map((binding) => [binding.address, binding]));
  const files = new Set(requested.files);
  const hits = gatheredOutcomes({
    outcomes: report.hits.map((hit) => listedOutcome({ outcome: bindHit({ checks, files, hit }) })),
  });
  if (hits.outcome === "failed") return hits;
  const detail =
    unrequestedFileDetail({ kind: "a measured pair", entries: report.measured, checks, files }) ??
    unrequestedFileDetail({
      kind: "an inapplicable pair",
      entries: report.inapplicable,
      checks,
      files,
    });
  if (detail !== undefined) return runnerInvalidOutput({ detail });
  const nativeExceptions = gatheredOutcomes({
    outcomes: report.nativeExceptions.map((exception) =>
      listedOutcome({ outcome: bindException({ checks, exception }) }),
    ),
  });
  return nativeExceptions.outcome === "failed"
    ? nativeExceptions
    : {
        outcome: "ok",
        value: { ...report, hits: hits.value, nativeExceptions: nativeExceptions.value },
      };
};

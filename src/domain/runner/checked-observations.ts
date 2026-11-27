import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { Result } from "../result.ts";
import type { CheckBinding } from "./check-binding.ts";
import type { CheckHit, CheckMeasurement, CheckNativeException } from "./check-observations.ts";
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
  readonly checks: ReadonlySet<CheckAddressText>;
  readonly files: ReadonlySet<RepoPath>;
}): string | undefined => {
  const entry = request.entries.find(
    ({ check, file }) => !request.checks.has(check) || !request.files.has(file),
  );
  return entry === undefined
    ? undefined
    : `${request.kind} names ${entry.check} in ${entry.file}, which the request did not hold`;
};

export const checkedObservations = <Report extends CheckObservations>(request: {
  readonly requested: ObservationRequest;
  readonly report: Report;
}): Result<Report, RunnerFailure> => {
  const { requested, report } = request;
  const checks = new Set(requested.bindings.map(({ address }) => address));
  const files = new Set(requested.files);
  const unrequestedNative = report.nativeExceptions.find(({ check }) => !checks.has(check));
  const detail =
    unrequestedFileDetail({ kind: "a hit", entries: report.hits, checks, files }) ??
    unrequestedFileDetail({ kind: "a measured pair", entries: report.measured, checks, files }) ??
    unrequestedFileDetail({
      kind: "an inapplicable pair",
      entries: report.inapplicable,
      checks,
      files,
    }) ??
    (unrequestedNative === undefined
      ? undefined
      : `a native exception names ${unrequestedNative.check}, which the request did not hold`);
  return detail === undefined ? { outcome: "ok", value: report } : runnerInvalidOutput({ detail });
};

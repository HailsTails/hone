import type { AttributedNativeException, Finding } from "../../finding/governance.ts";
import type { ExemptedFinding } from "./governance.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { type DebtPair, debtPairKey, distinctDebtPairs } from "./debt-pair.ts";
import type { ExceptionRecord } from "./exception-record.ts";
import { authorisationStandingOf, type ExceptionBaseline } from "./exception-baseline.ts";
import { exclusionOf } from "../../repository/exclusion.ts";
import type { MechanismRun } from "../../runner/mechanism-run.ts";

type RunOfMechanism = Pick<MechanismRun, "mechanism" | "projection">;

export type PaidDebtRequest = {
  readonly findings: readonly Finding[];
  readonly exempted: readonly ExemptedFinding[];
  readonly stale: readonly ExceptionRecord[];
  readonly forfeited: readonly ExceptionRecord[];
  readonly nativeExceptions: readonly AttributedNativeException[];
  readonly absent: readonly RepoPath[];
  readonly excluded: readonly RepoPath[];
  readonly runs: readonly RunOfMechanism[];
  readonly measured: readonly DebtPair[];
  readonly baseline: ExceptionBaseline;
};

type FileCarveOut = Extract<ExceptionRecord, { readonly kind: "file-carve-out" }>;

type SettlingEvidence = Pick<PaidDebtRequest, "absent" | "excluded" | "runs" | "measured">;

const PROJECTIONS_THAT_DID_NOT_RUN: readonly RunOfMechanism["projection"][] = ["missing", "not-included"];

const answeredByAuthorisedLocation = (request: {
  readonly exempted: ExemptedFinding;
  readonly baseline: ExceptionBaseline;
}): "answered" | "still-debt" =>
  request.exempted.by.some(
    (record) =>
      record.kind === "authorised-location" && authorisationStandingOf({ record, baseline: request.baseline }) === "established",
  )
    ? "answered"
    : "still-debt";

const nativeFileOf = (request: { readonly exception: AttributedNativeException }): RepoPath | undefined => {
  switch (request.exception.kind) {
    case "command-line-option":
      return undefined;
    case "ignore":
    case "config-override":
    case "suppression-entry":
    case "inline-disable":
    case "inline-rule-config":
      return request.exception.file;
  }
};

const heldPairKeys = (request: PaidDebtRequest): ReadonlySet<string> =>
  new Set([
    ...request.findings.map((finding) => debtPairKey(finding)),
    ...request.exempted.flatMap((exempted) =>
      answeredByAuthorisedLocation({ exempted, baseline: request.baseline }) === "answered" ? [] : [debtPairKey(exempted.finding)],
    ),
    ...request.nativeExceptions.flatMap((exception) => {
      const file = nativeFileOf({ exception });
      return file === undefined ? [] : [debtPairKey({ clause: exception.clause, file })];
    }),
  ]);

const mechanismRanOf = (request: { readonly runs: readonly RunOfMechanism[]; readonly record: FileCarveOut }): "ran" | "did-not-run" =>
  request.runs.some((run) => run.mechanism === request.record.mechanism && !PROJECTIONS_THAT_DID_NOT_RUN.includes(run.projection))
    ? "ran"
    : "did-not-run";

const exclusionStandingOf = (request: Pick<SettlingEvidence, "excluded" | "runs"> & { readonly record: FileCarveOut }): "established" | "unestablished" =>
  exclusionOf({ path: request.record.file, excluded: request.excluded }) === "excluded" && mechanismRanOf(request) === "ran"
    ? "established"
    : "unestablished";

const settlementOf = (
  request: SettlingEvidence & { readonly record: FileCarveOut; readonly measuredKeys: ReadonlySet<string> },
): "settled" | "unsettled" =>
  request.absent.includes(request.record.file) ||
  request.measuredKeys.has(debtPairKey(request.record)) ||
  exclusionStandingOf(request) === "established"
    ? "settled"
    : "unsettled";

const settledCarveOutPairs = (request: SettlingEvidence & Pick<PaidDebtRequest, "stale" | "forfeited">): readonly DebtPair[] => {
  const measuredKeys = new Set(request.measured.map((pair) => debtPairKey(pair)));
  return [...request.stale, ...request.forfeited].flatMap((record) =>
    record.kind === "file-carve-out" && settlementOf({ ...request, record, measuredKeys }) === "settled"
      ? [{ clause: record.clause, file: record.file }]
      : [],
  );
};

export const paidDebtOf = (request: PaidDebtRequest): readonly DebtPair[] => {
  const held = heldPairKeys(request);
  return distinctDebtPairs({ pairs: settledCarveOutPairs(request).filter((pair) => !held.has(debtPairKey(pair))) });
};

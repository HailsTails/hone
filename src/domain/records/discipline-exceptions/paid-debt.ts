import type { AttributedNativeException, Finding } from "../../finding/governance.ts";
import type { ExemptedFinding } from "./governance.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { type DebtPair, debtPairKey, distinctDebtPairs } from "./debt-pair.ts";
import type { ExceptionRecord } from "./exception-record.ts";
import { authorisationStandingOf, type ExceptionBaseline } from "./exception-baseline.ts";

export type PaidDebtRequest = {
  readonly findings: readonly Finding[];
  readonly exempted: readonly ExemptedFinding[];
  readonly stale: readonly ExceptionRecord[];
  readonly forfeited: readonly ExceptionRecord[];
  readonly nativeExceptions: readonly AttributedNativeException[];
  readonly absent: readonly RepoPath[];
  readonly measured: readonly DebtPair[];
  readonly baseline: ExceptionBaseline;
};

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

const settledCarveOutPairs = (request: Pick<PaidDebtRequest, "stale" | "forfeited" | "absent" | "measured">): readonly DebtPair[] => {
  const measured = new Set(request.measured.map((pair) => debtPairKey(pair)));
  return [...request.stale, ...request.forfeited].flatMap((record) =>
    record.kind === "file-carve-out" && (request.absent.includes(record.file) || measured.has(debtPairKey(record)))
      ? [{ clause: record.clause, file: record.file }]
      : [],
  );
};

export const paidDebtOf = (request: PaidDebtRequest): readonly DebtPair[] => {
  const held = heldPairKeys(request);
  return distinctDebtPairs({ pairs: settledCarveOutPairs(request).filter((pair) => !held.has(debtPairKey(pair))) });
};

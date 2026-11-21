import type { Finding, GovernedRun } from "../../../domain/finding/governance.ts";
import type { Result } from "../../../domain/result.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { OracleFailure } from "./record-answer-oracle.ts";

export type EngineFindings = { readonly findings: readonly Finding[]; readonly runs: readonly GovernedRun[] };

export type EnginePassFailure = Extract<OracleFailure, { readonly kind: "version-one-run-failed" | "projection-not-current" }>;

export type EnginePass = {
  readonly findingsFor: (request: { readonly records: readonly ExceptionRecord[] }) => Promise<Result<EngineFindings, EnginePassFailure>>;
};

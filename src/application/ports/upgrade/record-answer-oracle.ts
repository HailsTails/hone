import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { CarveOutAnswer, LocationAnswer } from "../../../domain/records/upgrade/records-mapping.ts";

export type FileCarveOutRecord = Extract<ExceptionRecord, { readonly kind: "file-carve-out" }>;

export type AuthorisedLocationRecord = Extract<ExceptionRecord, { readonly kind: "authorised-location" }>;

export type CarveOutAnswered = { readonly kind: "file-carve-out"; readonly record: FileCarveOutRecord; readonly answer: CarveOutAnswer };

export type ProjectionNotCurrentState = "out-of-date" | "missing" | "not-applied" | "not-included" | "unconfigured";

export type LocationAnswered = { readonly kind: "authorised-location"; readonly record: AuthorisedLocationRecord; readonly answer: LocationAnswer };

export type RecordAnswered = CarveOutAnswered | LocationAnswered;

export type OracleFailure =
  | { readonly kind: "version-one-run-failed"; readonly detail: string }
  | { readonly kind: "projection-not-current"; readonly file: RepoPath; readonly state: ProjectionNotCurrentState }
  | { readonly kind: "finding-not-attributable"; readonly clause: string; readonly file: RepoPath; readonly check: string | undefined }
  | { readonly kind: "record-doubly-held"; readonly clause: string; readonly file: RepoPath };

export type RecordAnswerOracle = {
  readonly answer: (request: { readonly records: readonly ExceptionRecord[] }) => Promise<Result<readonly RecordAnswered[], OracleFailure>>;
};

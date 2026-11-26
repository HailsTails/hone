import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { ForfeitureAssessment } from "../../../domain/settings/assessment.ts";
import type { ReportOutput } from "../../../domain/settings/report-output.ts";

export type CheckArguments<Output extends string> = {
  readonly repo: string;
  readonly baseRevision: string | undefined;
  readonly reportOutput: Output | undefined;
  readonly compareDebtAt?: string;
  readonly forfeiture: ForfeitureAssessment | undefined;
};

export type PruneDebtArguments = {
  readonly repo: string;
  readonly baseRevision: string | undefined;
  readonly forfeiture: ForfeitureAssessment | undefined;
};

export type ProjectArguments = {
  readonly repo: string;
};

export type SplitRecordsArguments = {
  readonly repo: string;
};

export type RecordDebtArguments = {
  readonly repo: string;
  readonly baseRevision: string;
  readonly leave: readonly RepoPath[];
};

export type UpgradeArguments = {
  readonly repo: string;
};

export type AuthoriseArguments = {
  readonly repo: string;
  readonly values: ReadonlyMap<string, readonly string[]>;
};

export type CheckLocations = {
  readonly arguments: CheckArguments<ReportOutput>;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

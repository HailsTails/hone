import type { RuleContent } from "../../../domain/language-layer/rule-content.ts";
import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type ProofRunFailure = { readonly kind: "run-failed"; readonly detail: string };

export type ProofWritten = { readonly written: readonly RepoPath[] };

export type ProofCheck = { readonly report: RunReport; readonly failing: readonly string[] };

export type ProofRuns = {
  readonly versionOne: () => Promise<Result<CheckReport, ProofRunFailure>>;
  readonly versionTwo: (request: ProofWritten) => Promise<Result<ProofCheck, ProofRunFailure>>;
};

export type CheckReportPointers = {
  readonly symptomPage: string;
  readonly pruneCommand: string;
  readonly projectCommand: string;
};

export type ProofRunSources = {
  readonly versionOne: () => Promise<Result<CheckReport, LoadFailure>>;
  readonly versionTwo: (request: ProofWritten) => Promise<
    Result<
      {
        readonly report: RunReport;
        readonly catalogue: SymptomCatalogue;
        readonly content: RuleContent;
      },
      RunLoadFailure
    >
  >;
  readonly pointers: CheckReportPointers;
};

export type ProofRunsOf = (sources: ProofRunSources) => ProofRuns;

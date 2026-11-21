import type { Check } from "../../../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../../../domain/repository/absolute-path-types.ts";
import type { EslintConfigLookup } from "../../../../domain/settings/eslint-config-lookup.ts";
import type { ClauseAddress } from "../../../../domain/rule-set/clause-address-types.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { StandaloneRunner } from "../runner-module/runner-module-schema.ts";
import type { Hit, MeasuredPair, NativeException, ProjectionState } from "../../../../domain/runner/runner-result-types.ts";
import type { AnsweredFile, ChecksSliceProblem, MisnamedRuleId, NotReadyYetFailure, ProjectedFile } from "../../../../domain/runner/checks-run-report.ts";

export type ChecksBinding = {
  readonly mechanism: string;
  readonly clause: { readonly address: ClauseAddress; readonly pieceRoot: string; readonly settings: unknown };
};

export type ChecksRunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly checks: readonly Check[];
  readonly bindings: readonly ChecksBinding[];
  readonly answered: readonly AnsweredFile[];
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly declaredConfigLookup: EslintConfigLookup | undefined;
};

export type ChecksRunReport = {
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly measured: readonly MeasuredPair[];
  readonly projection: ProjectionState;
  readonly slices: readonly ChecksSliceProblem[];
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
};

export type ChecksRunFailure = RunnerFailure | NotReadyYetFailure;

export type ChecksRunner = {
  readonly run: (request: ChecksRunRequest) => Promise<Result<ChecksRunReport, ChecksRunFailure>>;
  readonly conform: StandaloneRunner["conform"];
  readonly project: (request: ChecksRunRequest) => Promise<Result<readonly ProjectedFile[], ChecksRunFailure>>;
};

export type LoadedChecksRunner = ChecksRunner & { readonly projectedKinds: readonly NativeException["kind"][] };

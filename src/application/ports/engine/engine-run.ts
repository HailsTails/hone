import type { Engine, Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type {
  CheckHit,
  CheckMeasurement,
  CheckNativeException,
} from "../../../domain/runner/check-observations.ts";
import type {
  AnsweredFile,
  ChecksProjectionProblem,
  MisnamedRuleId,
} from "../../../domain/runner/checks-run-report.ts";
import type { UnprojectedFolderReport } from "../../../domain/runner/mechanism-run.ts";
import type { ProjectionState } from "../../../domain/runner/runner-result-types.ts";
import type { EslintConfigLookup } from "../../../domain/settings/eslint-config-lookup.ts";
import type { TestFiles } from "../../../domain/settings/test-files.ts";
import type { ProjectionKind } from "../settings/settings-file-format.ts";

export type EngineCheck = {
  readonly name: string;
  readonly symptom: Pick<Symptom, "ruleSet" | "name" | "title">;
  readonly engines: readonly Engine[];
};

export type NamedEngineRunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly answered: readonly AnsweredFile[];
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly declaredConfigLookup: EslintConfigLookup | undefined;
  readonly testFiles: TestFiles;
  readonly bindings: readonly CheckBinding[];
  readonly checks?: readonly EngineCheck[];
};

export type NamedEslintRunRequest = NamedEngineRunRequest & {
  readonly projectionKind: ProjectionKind;
};

export type NamedEngineProjection =
  | { readonly projection: "none" }
  | { readonly projection: "current" }
  | { readonly projection: "current-with-file"; readonly projectionFile: RepoPath }
  | {
      readonly projection: Exclude<ProjectionState, "current">;
      readonly projectionFile: RepoPath;
    };

export type NamedEngineRun = NamedEngineProjection & {
  readonly mechanism: EngineId;
  readonly comparedOutputs: readonly RepoPath[];
  readonly candidateFiles: readonly RepoPath[];
  readonly coverableKinds: readonly CheckNativeException["kind"][];
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
  readonly slices: readonly ChecksProjectionProblem[];
  readonly nestedConfigurations: readonly RepoPath[];
  readonly unprojectedFolders: readonly UnprojectedFolderReport[];
  readonly hits: readonly CheckHit[];
  readonly nativeExceptions: readonly CheckNativeException[];
  readonly measured: readonly CheckMeasurement[];
  readonly inapplicable: readonly CheckMeasurement[];
};

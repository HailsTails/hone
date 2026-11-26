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
  ChecksSliceProblem,
  MisnamedRuleId,
} from "../../../domain/runner/checks-run-report.ts";
import type { UnprojectedFolderReport } from "../../../domain/runner/mechanism-run.ts";
import type { ProjectionState } from "../../../domain/runner/runner-result-types.ts";
import type { EslintConfigLookup } from "../../../domain/settings/eslint-config-lookup.ts";
import type { TestFiles } from "../../../domain/settings/test-files.ts";
import type { RunnerCall } from "./runner-module.ts";

export type RunnerFileScope = "tracked" | "typescript";

export type ParsedNamedRunner = {
  readonly fileScope: RunnerFileScope;
  readonly projectedKinds: readonly CheckNativeException["kind"][];
  readonly run: RunnerCall;
  readonly conform: RunnerCall;
  readonly project: RunnerCall;
  readonly outputPaths: RunnerCall;
};

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

export type NamedEngineRun = {
  readonly mechanism: EngineId;
  readonly coverableKinds: readonly CheckNativeException["kind"][];
  readonly projection: "none" | ProjectionState;
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
  readonly slices: readonly ChecksSliceProblem[];
  readonly nestedConfigurations: readonly RepoPath[];
  readonly unprojectedFolders: readonly UnprojectedFolderReport[];
  readonly hits: readonly CheckHit[];
  readonly nativeExceptions: readonly CheckNativeException[];
  readonly measured: readonly CheckMeasurement[];
};

import type { NamedEngineRunRequest } from "../../../../../application/ports/engine/engine-run.ts";
import { failureDetailOf } from "../../../../../domain/failure-detail.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type {
  ProjectedFile,
  ProjectionEntry,
} from "../../../../../domain/runner/checks-run-report.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { readRule } from "../selected-rule.ts";
import { createOxlintProjection, type ProjectionRule } from "./oxlint-projection.ts";
import { createProjectionScopes, type ProjectionScope } from "./scopes.ts";

const path = createDefaultPathPort({});

export type PlannedProjection = ProjectionScope &
  (
    | { readonly config: undefined }
    | { readonly config: RepoPath; readonly generated: ProjectedFile }
  );

export type ProjectionPlan = {
  readonly scopes: readonly PlannedProjection[];
  readonly rules: readonly ProjectionRule[];
  readonly entries: readonly ProjectionEntry[];
};

export const createProjectionPlan = (
  request: NamedEngineRunRequest,
): Result<ProjectionPlan, RunnerFailure> => {
  const rules = gatheredOutcomes({
    outcomes: request.bindings.map((binding) =>
      listedOutcome({
        outcome: readProjectedRule({ installRoot: request.installRoot, binding }),
      }),
    ),
  });
  if (rules.outcome === "failed") return rules;
  try {
    const scopes = createProjectionScopes(request).map((scope): PlannedProjection => {
      if (scope.config === undefined) return { ...scope, config: undefined };
      const { file } = createOxlintProjection({
        path,
        root: request.repoRoot,
        installRoot: request.installRoot,
        scope,
        rules: rules.value,
        answers: request.answered,
      });
      return { ...scope, config: scope.config, generated: file };
    });
    const entries = scopes.flatMap((scope) =>
      scope.config === undefined ? [] : [scope.generated],
    );
    return { outcome: "ok", value: { scopes, entries, rules: rules.value } };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: failureDetailOf({ thrown }) },
    };
  }
};

const readProjectedRule = (
  request: Parameters<typeof readRule>[0],
): Result<ProjectionRule, RunnerFailure> => {
  const rule = readRule(request);
  return rule.outcome === "failed"
    ? rule
    : { outcome: "ok", value: { binding: request.binding, rule: rule.value } };
};

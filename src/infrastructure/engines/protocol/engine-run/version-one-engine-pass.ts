import { type CheckRequest, findingsOf, loadInputs, mechanismRuns, projectionOutcome, sliceProblemsOf, treeOf } from "../../../../application/run/check/run-check.ts";
import type { MechanismId } from "../../../../domain/rule-set/identifier-types.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import { loadFailureDetail } from "../../../printed-report/load-failures/load-failure-text.ts";
import type { LoadFailure } from "../../../../domain/report/load-failure.ts";
import type { MechanismRun } from "../../../../domain/runner/mechanism-run.ts";
import type { Result } from "../../../../domain/result.ts";
import type { EngineFindings, EnginePass, EnginePassFailure } from "../../../../application/upgrade/record-answers/answering-oracle.ts";
import { UNMEASURED_EXCEPTION_BASELINE } from "../../../../domain/records/discipline-exceptions/exception-baseline.ts";

const failureOf = (request: { readonly failure: LoadFailure }): Result<EngineFindings, EnginePassFailure> => ({
  outcome: "failed",
  error: { kind: "version-one-run-failed", detail: loadFailureDetail({ failure: request.failure }) },
});

const projectionFileOf = (request: { readonly mechanism: MechanismId }): RepoPath => repoPathSchema.parse(`disciplines.${request.mechanism}.mjs`);

const projectionFailureOf = (request: { readonly runs: readonly MechanismRun[] }): EnginePassFailure | undefined => {
  const outcomes = request.runs.map((run) => projectionOutcome({ run }));
  const slice = request.runs.flatMap((run) => sliceProblemsOf({ run }))[0];
  const notRun = outcomes.flatMap((outcome) => outcome.unmeasured).find((unmeasured) => unmeasured.kind === "mechanism-not-run");
  if (notRun?.kind === "mechanism-not-run" && !(notRun.projection === "not-included" && slice !== undefined)) {
    return { kind: "projection-not-current", file: projectionFileOf({ mechanism: notRun.mechanism }), state: notRun.projection };
  }
  const problem = [...outcomes.flatMap((outcome) => outcome.problems), ...(slice === undefined ? [] : [slice])][0];
  if (problem === undefined) {
    return undefined;
  }
  return {
    kind: "projection-not-current",
    file: problem.scope === "slice" ? problem.slice : projectionFileOf({ mechanism: problem.mechanism }),
    state: problem.state,
  };
};

export const createVersionOneEnginePass =(request: { readonly check: CheckRequest }): EnginePass => ({
  findingsFor: async ({ records }) => {
    const { check } = request;
    const inputs = await loadInputs({ ...check, exceptionBaselineOf: () => UNMEASURED_EXCEPTION_BASELINE });
    if (inputs.outcome === "failed") {
      return failureOf({ failure: inputs.error });
    }
    const tree = treeOf({ check, inputs: inputs.value });
    if (tree.outcome === "failed") {
      return failureOf({ failure: tree.error });
    }
    const runs = await mechanismRuns({ check, tree: tree.value, inputs: { ...inputs.value, records } });
    if (runs.outcome === "failed") {
      return failureOf({ failure: runs.error });
    }
    const projectionFailure = projectionFailureOf({ runs: runs.value });
    return projectionFailure === undefined
      ? { outcome: "ok", value: { findings: findingsOf({ runs: runs.value }), runs: runs.value } }
      : { outcome: "failed", error: projectionFailure };
  },
});

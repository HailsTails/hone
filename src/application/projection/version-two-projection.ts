import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { ProjectionEntry } from "../../domain/runner/checks-run-report.ts";
import { type VersionTwoStages, versionTwoInputsOf } from "../run/version-two-run.ts";

export const versionTwoProjectionOver = async (request: {
  readonly stages: VersionTwoStages;
}): Promise<Result<readonly ProjectionEntry[], RunLoadFailure>> => {
  const inputs = versionTwoInputsOf(request);
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const { catalogue, settings, records, checks } = inputs.value;
  const tree = request.stages.tree({ settings });
  return tree.outcome === "failed"
    ? tree
    : request.stages.projections({ catalogue, settings, records, checks, tree: tree.value });
};

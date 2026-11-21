import type { ProjectedFile } from "../../infrastructure/engines/protocol/checks/checks-runner-types.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { Result } from "../../domain/result.ts";
import { type VersionTwoStages, versionTwoInputsOf } from "../run/version-two-run.ts";

export const versionTwoProjectionOver = async (request: { readonly stages: VersionTwoStages }): Promise<Result<readonly ProjectedFile[], RunLoadFailure>> => {
  const inputs = versionTwoInputsOf(request);
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const tree = request.stages.tree({ settings: inputs.value.settings });
  return tree.outcome === "failed" ? tree : request.stages.projections({ ...inputs.value, tree: tree.value });
};

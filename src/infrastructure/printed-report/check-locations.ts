import type { FileTextPort } from "../node/file-system/file-text-port.ts";
import type { PathPort } from "../node/path-port.ts";
import type { AbsolutePath } from "../content-files/absolute-path.ts";
import type { Result } from "../../domain/result.ts";
import { argumentsInvalid } from "../command-line/arguments/argument-problem.ts";
import { type CheckArguments, parseCheckArguments } from "../command-line/arguments/command-arguments.ts";
import { reportOutputSchema, type ReportOutput } from "../hone-config-file/report-output.ts";
import { installRootOf } from "../command-line/installation/install-root.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";

const SELECTION_FILE_NAME = "disciplines.json";

export type CheckLocations = {
  readonly arguments: CheckArguments<ReportOutput>;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

export const repoRootOf = (request: {
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly repo: string;
}): Result<AbsolutePath, LoadFailure> => {
  const resolved = request.path.resolve({ path: request.repo });
  if (resolved.outcome === "failed") {
    return argumentsInvalid({ problem: { kind: "repo-unresolvable", given: request.repo } });
  }
  const selection = request.path.join({ segments: [resolved.value, SELECTION_FILE_NAME] });
  return request.fileText.exists({ path: selection }) === "absent"
    ? { outcome: "failed", error: { kind: "selection-absent", repo: request.repo } }
    : resolved;
};

export const checkLocationsFor = (request: {
  readonly arguments: readonly string[];
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly moduleUrl: string;
}): Result<CheckLocations, LoadFailure> => {
  const parsed = parseCheckArguments({ arguments: request.arguments, reportOutputs: reportOutputSchema.options });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  return installRoot.outcome === "failed"
    ? installRoot
    : { outcome: "ok", value: { arguments: parsed.value, repoRoot: repoRoot.value, installRoot: installRoot.value } };
};

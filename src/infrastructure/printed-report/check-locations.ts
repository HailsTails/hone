import type {
  CheckArguments,
  CheckLocations,
} from "../../application/ports/command/command-arguments.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { REPORT_OUTPUTS, type ReportOutput } from "../../domain/settings/report-output.ts";
import { argumentsInvalid } from "../command-line/arguments/argument-problem.ts";
import { parseCheckArguments } from "../command-line/arguments/command-arguments.ts";
import { installRootOf } from "../command-line/installation/install-root.ts";

const SELECTION_FILE_NAME = "disciplines.json";

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

export const checkLocationsOf = (request: {
  readonly arguments: CheckArguments<ReportOutput>;
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly moduleUrl: string;
}): Result<CheckLocations, LoadFailure> => {
  const repoRoot = repoRootOf({
    path: request.path,
    fileText: request.fileText,
    repo: request.arguments.repo,
  });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  return installRoot.outcome === "failed"
    ? installRoot
    : {
        outcome: "ok",
        value: {
          arguments: request.arguments,
          repoRoot: repoRoot.value,
          installRoot: installRoot.value,
        },
      };
};

export const checkLocationsFor = (request: {
  readonly arguments: readonly string[];
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly moduleUrl: string;
}): Result<CheckLocations, LoadFailure> => {
  const parsed = parseCheckArguments({
    arguments: request.arguments,
    reportOutputs: REPORT_OUTPUTS,
  });
  return parsed.outcome === "failed"
    ? parsed
    : checkLocationsOf({ ...request, arguments: parsed.value });
};

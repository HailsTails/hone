import { UNMEASURED_EXCEPTION_BASELINE } from "../../domain/records/discipline-exceptions/exception-baseline.ts";
import type { ExceptionRecord } from "../../domain/records/discipline-exceptions/exception-record.ts";
import type { ProjectionRequest } from "../ports/engine/runner-module.ts";
import type { ProjectionWrite } from "../../domain/runner/runner-result-types.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { SelectionRepositoryOf } from "../ports/selection/selection-repository.ts";
import type { Result } from "../../domain/result.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { CheckedTree } from "../run/checked-tree-of.ts";
import {
  allOk,
  type CheckRequest,
  type LoadedMechanism,
  loadInputs,
  recordsOf,
  runnerFailed,
  treeOf,
} from "../run/check/run-check.ts";

export type ProjectRequest = Omit<CheckRequest, "baseRevision" | "assessment" | "selectionRepository" | "fileText" | "shownPathOf"> & {
  readonly fileText: FileTextPort;
  readonly selectionRepositoryOf: SelectionRepositoryOf;
};

type ProjectionInputs = {
  readonly project: ProjectRequest;
  readonly records: readonly ExceptionRecord[];
  readonly tree: CheckedTree;
  readonly loaded: LoadedMechanism;
};

const projectionRequestOf = (request: ProjectionInputs): ProjectionRequest => ({
  repoRoot: request.project.repoRoot,
  installRoot: request.project.installRoot,
  trackedPaths: request.tree.tracked,
  declaredConfigRoots: request.tree.declaredConfigRoots,
  clauses: request.loaded.clauses,
  records: recordsOf({ records: request.records, mechanism: request.loaded.mechanism }),
});

const projectionWritesOf = (request: ProjectionInputs): Promise<Result<readonly ProjectionWrite[], LoadFailure>> =>
  request.project.engine.project.withRecords({ runner: request.loaded.runner, request: projectionRequestOf(request) }).then(
    (runnerResult) => runnerFailed({ mechanism: request.loaded.mechanism, runnerResult }),
  );

export const runProject = async (
  request: ProjectRequest,
): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  const inputs = await loadInputs({
    ...request,
    selectionRepository: request.selectionRepositoryOf(request),
    exceptionBaselineOf: () => UNMEASURED_EXCEPTION_BASELINE,
  });
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const tree = treeOf({ check: request, inputs: inputs.value });
  if (tree.outcome === "failed") {
    return tree;
  }
  const writes = allOk({
    results: await Promise.all(
      inputs.value.mechanisms.map((loaded) =>
        projectionWritesOf({ project: request, records: inputs.value.records, tree: tree.value, loaded }),
      ),
    ),
  });
  if (writes.outcome === "failed") {
    return writes;
  }
  return { outcome: "ok", value: writes.value.flat() };
};

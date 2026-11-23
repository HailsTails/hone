import { gatheredOutcomes, listedOutcome } from "../../../domain/gathered-outcomes.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { AnsweredFile, ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type {
  NamedEngineCall,
  NamedEngineFailure,
  NamedEnginePort,
} from "../../ports/engine/engine-port.ts";
import type {
  EngineCheck,
  NamedEngineRun,
  NamedEngineRunRequest,
} from "../../ports/engine/engine-run.ts";
import type { RunnerLocation } from "../../ports/engine/runner-location.ts";
import { type CheckedTree, typescriptFilesOf } from "../checked-tree-of.ts";
import type { NamedSettingsReading } from "../settings/read-settings.ts";

export type NamedEnginesRequest = Omit<RunnerLocation, "mechanism"> & {
  readonly settings: NamedSettingsReading;
  readonly repoRoot: AbsolutePath;
  readonly tree: CheckedTree;
  readonly checks: readonly EngineCheck[];
  readonly answered: readonly AnsweredFile[];
  readonly engine: NamedEnginePort;
};

const engineRequestOf = (request: NamedEnginesRequest): NamedEngineRunRequest => ({
  repoRoot: request.repoRoot,
  installRoot: request.installRoot,
  files: typescriptFilesOf({ tracked: request.tree.tracked }),
  trackedPaths: request.tree.tracked,
  bindings: request.settings.selection.selected.map(({ binding }) => binding),
  checks: request.checks,
  answered: request.answered,
  declaredConfigRoots: request.tree.declaredConfigRoots,
  declaredConfigLookup:
    request.settings.eslintConfigLookup.lookup === "declared"
      ? request.settings.eslintConfigLookup.value
      : undefined,
  testFiles: request.settings.conventions.testFiles,
});

export const namedEngineCallsOf = async <Value>(
  request: NamedEnginesRequest & {
    readonly call: (call: NamedEngineCall) => Promise<Result<Value, NamedEngineFailure>>;
  },
): Promise<Result<readonly Value[], NamedEngineFailure>> => {
  const engineRequest = engineRequestOf(request);
  const mechanisms = new Set(engineRequest.bindings.map(({ engine }) => engine));
  const outcomes = await Promise.all(
    [...mechanisms].map(async (mechanism) => {
      const { installRoot, moduleExtension, modules, path } = request;
      const runner = await request.engine.load({
        installRoot,
        moduleExtension,
        modules,
        path,
        mechanism,
      });
      const outcome =
        runner.outcome === "failed"
          ? runner
          : await request.call({ mechanism, runner: runner.value, request: engineRequest });
      return listedOutcome({ outcome });
    }),
  );
  return gatheredOutcomes({ outcomes });
};

export const namedEngineRunsOf = (
  request: NamedEnginesRequest,
): Promise<Result<readonly NamedEngineRun[], NamedEngineFailure>> =>
  namedEngineCallsOf({ ...request, call: request.engine.run });

export const namedEngineProjectionsOf = async (
  request: NamedEnginesRequest,
): Promise<Result<readonly ProjectedFile[], NamedEngineFailure>> => {
  const projected = await namedEngineCallsOf({ ...request, call: request.engine.project });
  return projected.outcome === "failed"
    ? projected
    : { outcome: "ok", value: projected.value.flat() };
};

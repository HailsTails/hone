import { gatheredOutcomes, listedOutcome } from "../../../domain/gathered-outcomes.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { CheckedTree } from "../../../domain/repository/checked-tree.ts";
import type { Result } from "../../../domain/result.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { AnsweredFile, ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type { Conventions } from "../../../domain/settings/conventions.ts";
import type { EslintConfigLookupChoice } from "../../../domain/settings/settings-file.ts";
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
import { typescriptFilesOf } from "../checked-tree-of.ts";
import { mapRequestToJudgedRequest } from "./judged-request.ts";

export type EngineSettings = {
  readonly selection: { readonly selected: readonly { readonly binding: CheckBinding }[] };
  readonly eslintConfigLookup: EslintConfigLookupChoice;
  readonly conventions: Pick<Conventions, "testFiles">;
};

export type NamedEnginesRequest = Omit<RunnerLocation, "mechanism"> & {
  readonly settings: EngineSettings;
  readonly repoRoot: AbsolutePath;
  readonly tree: CheckedTree;
  readonly checks: readonly EngineCheck[];
  readonly answered: readonly AnsweredFile[];
  readonly engine: NamedEnginePort;
};

export const mapEnginesRequestToRunRequest = (
  request: Pick<
    NamedEnginesRequest,
    "repoRoot" | "installRoot" | "tree" | "settings" | "checks" | "answered"
  >,
): NamedEngineRunRequest => ({
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

type EngineCall<Value> = (call: NamedEngineCall) => Promise<Result<Value, NamedEngineFailure>>;

type LoadedEngine = Pick<NamedEngineCall, "mechanism" | "runner">;

const loadEngines = async (
  request: NamedEnginesRequest & { readonly engineRequest: NamedEngineRunRequest },
): Promise<Result<readonly LoadedEngine[], NamedEngineFailure>> => {
  const mechanisms = new Set(request.engineRequest.bindings.map(({ engine }) => engine));
  const { installRoot, moduleExtension, modules, path } = request;
  const outcomes = await Promise.all(
    [...mechanisms].map(async (mechanism) => {
      const runner = await request.engine.load({
        installRoot,
        moduleExtension,
        modules,
        path,
        mechanism,
      });
      return listedOutcome({
        outcome:
          runner.outcome === "failed"
            ? runner
            : { outcome: "ok", value: { mechanism, runner: runner.value } },
      });
    }),
  );
  return gatheredOutcomes({ outcomes });
};

const callEngines = async <Value>(request: {
  readonly engines: readonly LoadedEngine[];
  readonly engineRequest: NamedEngineRunRequest;
  readonly call: EngineCall<Value>;
}): Promise<Result<readonly Value[], NamedEngineFailure>> =>
  gatheredOutcomes({
    outcomes: await Promise.all(
      request.engines.map(async (engine) =>
        listedOutcome({
          outcome: await request.call({ ...engine, request: request.engineRequest }),
        }),
      ),
    ),
  });

export const namedEngineCallsOf = async <Value>(
  request: NamedEnginesRequest & { readonly call: EngineCall<Value> },
): Promise<Result<readonly Value[], NamedEngineFailure>> => {
  const engineRequest = mapEnginesRequestToRunRequest(request);
  const engines = await loadEngines({ ...request, engineRequest });
  return engines.outcome === "failed"
    ? engines
    : callEngines({ engines: engines.value, engineRequest, call: request.call });
};

export const namedEngineRunsOf = async (
  request: NamedEnginesRequest,
): Promise<Result<readonly NamedEngineRun[], NamedEngineFailure>> => {
  const engineRequest = mapEnginesRequestToRunRequest(request);
  const engines = await loadEngines({ ...request, engineRequest });
  if (engines.outcome === "failed") {
    return engines;
  }
  const projected = await callEngines({
    engines: engines.value,
    engineRequest,
    call: request.engine.project,
  });
  return projected.outcome === "failed"
    ? projected
    : callEngines({
        engines: engines.value,
        engineRequest: mapRequestToJudgedRequest({
          engineRequest,
          outputs: projected.value.flat().map(({ file }) => file),
        }),
        call: request.engine.run,
      });
};

export const namedEngineProjectionsOf = async (
  request: NamedEnginesRequest,
): Promise<Result<readonly ProjectedFile[], NamedEngineFailure>> => {
  const projected = await namedEngineCallsOf({ ...request, call: request.engine.project });
  return projected.outcome === "failed"
    ? projected
    : { outcome: "ok", value: projected.value.flat() };
};

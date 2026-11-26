import { gatheredOutcomes, listedOutcome } from "../../../domain/gathered-outcomes.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { CheckedTree } from "../../../domain/repository/checked-tree.ts";
import type { Result } from "../../../domain/result.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { AnsweredFile, ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type { Conventions } from "../../../domain/settings/conventions.ts";
import type { EslintConfigLookupChoice } from "../../../domain/settings/settings-file.ts";
import type {
  LoadedEngine,
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

export type EngineSettings = {
  readonly selection: { readonly selected: readonly { readonly binding: CheckBinding }[] };
  readonly eslintConfigLookup: EslintConfigLookupChoice;
  readonly conventions: Pick<Conventions, "testFiles">;
};

type EnginesRequest = Omit<RunnerLocation, "mechanism"> & {
  readonly settings: EngineSettings;
  readonly repoRoot: AbsolutePath;
  readonly tree: CheckedTree;
  readonly checks: readonly EngineCheck[];
  readonly answered: readonly AnsweredFile[];
};

export type NamedEnginesRequest = EnginesRequest & { readonly engine: NamedEnginePort };

export const mapEnginesRequestToRunRequest = (
  request: Pick<
    EnginesRequest,
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

export const callNamedEngines = async <Value>(
  request: EnginesRequest & {
    readonly call: (
      location: RunnerLocation,
      request: NamedEngineRunRequest,
    ) => Promise<Result<Value, NamedEngineFailure>>;
  },
): Promise<Result<readonly Value[], NamedEngineFailure>> => {
  const engineRequest = mapEnginesRequestToRunRequest(request);
  const mechanisms = new Set(engineRequest.bindings.map(({ engine }) => engine));
  const { installRoot, moduleExtension, modules, path } = request;
  const outcomes = await Promise.all(
    [...mechanisms].map(async (mechanism) => {
      const outcome = await request.call(
        { installRoot, moduleExtension, modules, path, mechanism },
        engineRequest,
      );
      return listedOutcome({ outcome });
    }),
  );
  return gatheredOutcomes({ outcomes });
};

const callLoadedEngines = <Value>(
  request: NamedEnginesRequest,
  call: (
    engine: LoadedEngine,
    request: NamedEngineRunRequest,
  ) => Promise<Result<Value, NamedEngineFailure>>,
): Promise<Result<readonly Value[], NamedEngineFailure>> =>
  callNamedEngines({
    ...request,
    call: async (location, engineRequest) => {
      const engine = await request.engine.load(location);
      return engine.outcome === "failed" ? engine : call(engine.value, engineRequest);
    },
  });

export const runNamedEngines = (
  request: NamedEnginesRequest,
): Promise<Result<readonly NamedEngineRun[], NamedEngineFailure>> =>
  callLoadedEngines(request, (engine, engineRequest) => engine.run(engineRequest));

export const projectNamedEngines = async (
  request: NamedEnginesRequest,
): Promise<Result<readonly ProjectedFile[], NamedEngineFailure>> => {
  const projected = await callLoadedEngines(request, (engine, engineRequest) =>
    engine.project(engineRequest),
  );
  return projected.outcome === "failed"
    ? projected
    : { outcome: "ok", value: projected.value.flat() };
};

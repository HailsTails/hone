import { gatheredOutcomes, listedOutcome } from "../../../domain/gathered-outcomes.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { CheckedTree } from "../../../domain/repository/checked-tree.ts";
import type { Result } from "../../../domain/result.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { AnsweredFile, ProjectionEntry } from "../../../domain/runner/checks-run-report.ts";
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
import type { ProjectionKind } from "../../ports/settings/settings-file-format.ts";
import { typescriptFilesOf } from "../checked-tree-of.ts";
import { mapRequestToJudgedRequest } from "./judged-request.ts";

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

export type NamedEnginesRequest = EnginesRequest & {
  readonly engine: NamedEnginePort;
  readonly settings: EngineSettings & { readonly eslintProjectionKind: ProjectionKind };
};

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

type CallEngine<Value> = {
  readonly call: (
    location: RunnerLocation,
    request: NamedEngineRunRequest,
  ) => Promise<Result<Value, NamedEngineFailure>>;
};

const callSelectedEngines = async <Value>(
  request: Omit<RunnerLocation, "mechanism"> &
    CallEngine<Value> & { readonly engineRequest: NamedEngineRunRequest },
): Promise<Result<readonly Value[], NamedEngineFailure>> => {
  const { engineRequest } = request;
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

export const callNamedEngines = <Value>(
  request: EnginesRequest & CallEngine<Value>,
): Promise<Result<readonly Value[], NamedEngineFailure>> =>
  callSelectedEngines({ ...request, engineRequest: mapEnginesRequestToRunRequest(request) });

type LoadedEngines = {
  readonly engines: readonly LoadedEngine[];
  readonly engineRequest: NamedEngineRunRequest;
};

const loadNamedEngines = async (
  request: NamedEnginesRequest,
): Promise<Result<LoadedEngines, NamedEngineFailure>> => {
  const engineRequest = mapEnginesRequestToRunRequest(request);
  const engines = await callSelectedEngines({
    ...request,
    engineRequest,
    call: (location) =>
      request.engine.load(
        location.mechanism === "eslint"
          ? {
              ...location,
              mechanism: "eslint",
              projectionKind: request.settings.eslintProjectionKind,
            }
          : { ...location, mechanism: location.mechanism },
      ),
  });
  return engines.outcome === "failed"
    ? engines
    : { outcome: "ok", value: { engines: engines.value, engineRequest } };
};

const projectLoadedEngines = async ({
  engines,
  engineRequest,
}: LoadedEngines): Promise<Result<readonly ProjectionEntry[], NamedEngineFailure>> =>
  gatheredOutcomes({
    outcomes: await Promise.all(engines.map((engine) => engine.project(engineRequest))),
  });

export const runNamedEngines = async (
  request: NamedEnginesRequest,
): Promise<Result<readonly NamedEngineRun[], NamedEngineFailure>> => {
  const loaded = await loadNamedEngines(request);
  if (loaded.outcome === "failed") return loaded;
  const projected = await projectLoadedEngines(loaded.value);
  if (projected.outcome === "failed") return projected;

  const { engines, engineRequest } = loaded.value;
  const outputs = projected.value.map(({ file }) => file);
  const judged = mapRequestToJudgedRequest({ engineRequest, outputs });
  return gatheredOutcomes({
    outcomes: await Promise.all(
      engines.map(async (engine) => {
        const outcome = await engine.run(judged);
        return listedOutcome({
          outcome:
            outcome.outcome === "failed" ||
            outcome.value.projection === "none" ||
            outputs.length === 0
              ? outcome
              : { outcome: "ok", value: { ...outcome.value, comparedOutputs: outputs } },
        });
      }),
    ),
  });
};

export const projectNamedEngines = async (
  request: NamedEnginesRequest,
): Promise<Result<readonly ProjectionEntry[], NamedEngineFailure>> => {
  const loaded = await loadNamedEngines(request);
  return loaded.outcome === "failed" ? loaded : projectLoadedEngines(loaded.value);
};

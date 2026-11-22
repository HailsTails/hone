import { gatheredOutcomes, listedOutcome } from "../../../domain/gathered-outcomes.ts";
import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { answeredFilesOf } from "../../../domain/records/answering/answered-files.ts";
import type { RecordsReading } from "../../../domain/records/hone-records/hone-record.ts";
import { type RunFailureSource, runFailureOf } from "../../../domain/report/run-failure.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type { EslintConfigLookup } from "../../../domain/settings/eslint-config-lookup.ts";
import type { EnginePort } from "../../ports/engine/engine-port.ts";
import type { EngineRun, EngineRunRequest } from "../../ports/engine/engine-run.ts";
import type { ModuleExtension } from "../../ports/host/module-extension.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { type CheckedTree, typescriptFilesOf } from "../checked-tree-of.ts";
import type { SettingsReading } from "../settings/read-settings.ts";

export type EnginesRunRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly settings: SettingsReading;
  readonly records: RecordsReading;
  readonly tree: CheckedTree;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly path: Pick<PathPort, "join">;
  readonly modules: ModuleLoaderPort;
  readonly engine: EnginePort;
};

const mechanismsOf = (request: { readonly settings: SettingsReading }): readonly EngineId[] => [
  ...new Set(request.settings.selection.bindings.map((binding) => binding.mechanism)),
];

const declaredLookupOf = (request: {
  readonly settings: SettingsReading;
}): EslintConfigLookup | undefined => {
  const { eslintConfigLookup } = request.settings;
  return eslintConfigLookup.lookup === "declared" ? eslintConfigLookup.value : undefined;
};

const runRequestOf = (request: EnginesRunRequest): EngineRunRequest => ({
  repoRoot: request.repoRoot,
  installRoot: request.installRoot,
  files: typescriptFilesOf({ tracked: request.tree.tracked }),
  trackedPaths: request.tree.tracked,
  checks: request.catalogue.checks,
  bindings: request.settings.selection.bindings,
  answered: answeredFilesOf({ records: request.records.records }),
  declaredConfigRoots: request.tree.declaredConfigRoots,
  declaredConfigLookup: declaredLookupOf({ settings: request.settings }),
});

const runOf = async (
  request: EnginesRunRequest & { readonly mechanism: EngineId },
): Promise<Result<EngineRun, RunFailureSource>> => {
  const engine = await request.engine.load(request);
  return engine.outcome === "failed"
    ? engine
    : request.engine.run.checks({ engine: engine.value, request: runRequestOf(request) });
};

const projectionOf = async (
  request: EnginesRunRequest & { readonly mechanism: EngineId },
): Promise<Result<readonly ProjectedFile[], RunFailureSource>> => {
  const engine = await request.engine.load(request);
  return engine.outcome === "failed"
    ? engine
    : request.engine.project.checks({ engine: engine.value, request: runRequestOf(request) });
};

export const enginesProjectionOf = async (
  request: EnginesRunRequest,
): Promise<Result<readonly ProjectedFile[], RunLoadFailure>> => {
  const projections = await Promise.all(
    mechanismsOf(request).map((mechanism) =>
      projectionOf({ ...request, mechanism }).then((projected) =>
        listedOutcome({ outcome: projected }),
      ),
    ),
  );
  const gathered = gatheredOutcomes({ outcomes: projections });
  return gathered.outcome === "failed"
    ? {
        outcome: "failed",
        error: runFailureOf({ engines: request.catalogue.engines, source: gathered.error }),
      }
    : { outcome: "ok", value: gathered.value.flat() };
};

export const enginesRunOf = async (
  request: EnginesRunRequest,
): Promise<Result<readonly EngineRun[], RunLoadFailure>> => {
  const runs = await Promise.all(
    mechanismsOf(request).map((mechanism) =>
      runOf({ ...request, mechanism }).then((run) => listedOutcome({ outcome: run })),
    ),
  );
  const gathered = gatheredOutcomes({ outcomes: runs });
  return gathered.outcome === "failed"
    ? {
        outcome: "failed",
        error: runFailureOf({ engines: request.catalogue.engines, source: gathered.error }),
      }
    : gathered;
};

import type { RunMeasurement, RunMeasurements } from "../../../domain/records/measurement/measured-at.ts";
import type { EngineNotRun, RunProjectionProblem } from "../../../domain/report/run-report.ts";
import type { Engine, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { SelectedClause } from "../../../domain/settings/selection/selection.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { typescriptFilesOf } from "../checked-tree-of.ts";
import type { EngineRun } from "../../ports/engine/engine-run.ts";

type CatalogueEngines = Pick<SymptomCatalogue, "engines">;

const engineOf = (request: { readonly catalogue: CatalogueEngines; readonly mechanism: EngineId }): Engine =>
  request.catalogue.engines.find((engine) => engine.name === request.mechanism) ?? { name: request.mechanism };

export type EngineMeasurement = "measured-something" | "measured-nothing" | "nothing-selected" | "nothing-to-measure";

export const engineMeasurementOf = (request: { readonly run: RunMeasurement; readonly inReach: readonly RepoPath[] }): EngineMeasurement => {
  if (request.run.selected.length === 0) {
    return "nothing-selected";
  }
  if (request.inReach.length === 0) {
    return "nothing-to-measure";
  }
  return request.run.measured.length === 0 ? "measured-nothing" : "measured-something";
};

const runMeasurementOf = (request: { readonly run: EngineRun; readonly selected: readonly SelectedClause[] }): RunMeasurement => ({
  mechanism: request.run.mechanism,
  selected: request.selected.filter((clause) => clause.mechanism === request.run.mechanism).map((clause) => clause.address),
  measured: request.run.measured,
});

export const runMeasurementsOf = (request: { readonly runs: readonly EngineRun[]; readonly selected: readonly SelectedClause[]; readonly tracked: readonly RepoPath[]; readonly excluded: readonly RepoPath[] }): RunMeasurements => ({
  runs: request.runs.map((run) => runMeasurementOf({ run, selected: request.selected })),
  tracked: request.tracked,
  excluded: request.excluded,
});

const measuredNothingOf = (request: { readonly engine: Engine; readonly measurement: RunMeasurement; readonly tracked: readonly RepoPath[] }): readonly EngineNotRun[] =>
  engineMeasurementOf({ run: request.measurement, inReach: typescriptFilesOf({ tracked: request.tracked }) }) === "measured-nothing" ? [{ kind: "engine-not-run", engine: request.engine, projection: "measured-nothing" }] : [];

const notRunOf = (request: { readonly catalogue: CatalogueEngines; readonly run: EngineRun; readonly selected: readonly SelectedClause[]; readonly tracked: readonly RepoPath[] }): readonly EngineNotRun[] => {
  const engine = engineOf({ catalogue: request.catalogue, mechanism: request.run.mechanism });
  switch (request.run.projection) {
    case "missing":
      return [{ kind: "engine-not-run", engine, projection: "missing" }];
    case "not-included":
      return [{ kind: "engine-not-run", engine, projection: "not-included", nestedConfigurations: [] }];
    case "none":
      return [];
    case "current":
    case "out-of-date":
      return measuredNothingOf({ engine, measurement: runMeasurementOf(request), tracked: request.tracked });
  }
};

const projectionProblemOf = (request: { readonly engine: Engine; readonly run: EngineRun }): readonly RunProjectionProblem[] =>
  request.run.projection === "out-of-date" ? [{ scope: "projection", engine: request.engine, state: "out-of-date" }] : [];

const problemOf = (request: { readonly catalogue: CatalogueEngines; readonly run: EngineRun }): readonly RunProjectionProblem[] => {
  const engine = engineOf({ catalogue: request.catalogue, mechanism: request.run.mechanism });
  return [
    ...projectionProblemOf({ engine, run: request.run }),
    ...request.run.slices.map((slice): RunProjectionProblem => ({ scope: "slice", engine, state: slice.state, slice: slice.slice })),
  ];
};

export const engineUnmeasuredOf = (request: { readonly catalogue: CatalogueEngines; readonly runs: readonly EngineRun[]; readonly selected: readonly SelectedClause[]; readonly tracked: readonly RepoPath[] }): readonly EngineNotRun[] =>
  request.runs.flatMap((run) => notRunOf({ catalogue: request.catalogue, run, selected: request.selected, tracked: request.tracked }));

export const engineProblemsOf = (request: { readonly catalogue: CatalogueEngines; readonly runs: readonly EngineRun[] }): readonly RunProjectionProblem[] =>
  request.runs.flatMap((run) => problemOf({ catalogue: request.catalogue, run }));

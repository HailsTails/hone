import type { Engine, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  RunMeasurement,
  RunMeasurements,
} from "../../../domain/records/measurement/measured-at.ts";
import type {
  EngineNotRun,
  MissingProjection,
  RunProjectionProblem,
  RunUnmeasured,
} from "../../../domain/report/run-report.ts";
import { excludeProjectionOutputs } from "../../../domain/repository/projection-outputs.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { NamedEngineRun } from "../../ports/engine/engine-run.ts";
import { typescriptFilesOf } from "../checked-tree-of.ts";

type CatalogueEngines = Pick<SymptomCatalogue, "engines">;
type Selected = Pick<CheckBinding, "address" | "engine">;

const engineOf = (request: {
  readonly catalogue: CatalogueEngines;
  readonly mechanism: EngineId;
}): Engine =>
  request.catalogue.engines.find((engine) => engine.name === request.mechanism) ?? {
    name: request.mechanism,
  };

export type EngineMeasurement =
  | "measured-something"
  | "measured-nothing"
  | "nothing-selected"
  | "nothing-to-measure";

export const engineMeasurementOf = (request: {
  readonly run: RunMeasurement;
  readonly inReach: readonly RepoPath[];
}): EngineMeasurement => {
  if (request.run.selected.length === 0) {
    return "nothing-selected";
  }
  if (request.inReach.length === 0) {
    return "nothing-to-measure";
  }
  return request.run.measured.length === 0 ? "measured-nothing" : "measured-something";
};

const runMeasurementOf = (request: {
  readonly run: NamedEngineRun;
  readonly selected: readonly Selected[];
}): RunMeasurement => ({
  mechanism: request.run.mechanism,
  selected: request.selected
    .filter(({ engine }) => engine === request.run.mechanism)
    .map(({ address }) => address),
  measured: request.run.measured,
});

export const runMeasurementsOf = (request: {
  readonly runs: readonly NamedEngineRun[];
  readonly selected: readonly Selected[];
  readonly tracked: readonly RepoPath[];
  readonly excluded: readonly RepoPath[];
}): RunMeasurements => ({
  runs: request.runs.map((run) => runMeasurementOf({ run, selected: request.selected })),
  tracked: request.tracked,
  excluded: request.excluded,
});

const measuredNothingOf = (request: {
  readonly engine: Engine;
  readonly measurement: RunMeasurement;
  readonly tracked: readonly RepoPath[];
  readonly comparedOutputs: readonly RepoPath[];
}): readonly EngineNotRun[] => {
  const inReach = excludeProjectionOutputs({
    files: typescriptFilesOf({ tracked: request.tracked }),
    outputs: new Set(request.comparedOutputs),
  });
  return engineMeasurementOf({ run: request.measurement, inReach }) === "measured-nothing"
    ? [{ kind: "engine-not-run", engine: request.engine, projection: "measured-nothing" }]
    : [];
};

const notRunOf = (request: {
  readonly catalogue: CatalogueEngines;
  readonly run: NamedEngineRun;
  readonly selected: readonly Selected[];
  readonly tracked: readonly RepoPath[];
}): readonly EngineNotRun[] => {
  const engine = engineOf({ catalogue: request.catalogue, mechanism: request.run.mechanism });
  const { nestedConfigurations, measured } = request.run;
  const { projectionFile } = request.run;
  switch (request.run.projection) {
    case "missing":
      return [
        { kind: "engine-not-run", engine, projection: "missing", file: request.run.projectionFile },
      ];
    case "not-included":
      return [
        {
          kind: "engine-not-run",
          engine,
          projection: "not-included",
          file: request.run.projectionFile,
          nestedConfigurations,
          recovery: request.run.recovery,
        },
      ];
    case "none":
      return [];
    case "current":
    case "out-of-date":
      if (
        projectionFile !== undefined &&
        measured.length === 0 &&
        nestedConfigurations.length > 0
      ) {
        return [
          {
            kind: "engine-not-run",
            engine,
            projection: "not-included",
            file: projectionFile,
            nestedConfigurations,
            recovery: { kind: "include-projection" },
          },
        ];
      }
      return measuredNothingOf({
        engine,
        measurement: runMeasurementOf(request),
        tracked: request.tracked,
        comparedOutputs: request.run.comparedOutputs ?? [],
      });
  }
};

const projectionProblemOf = (request: {
  readonly engine: Engine;
  readonly run: NamedEngineRun;
}): readonly RunProjectionProblem[] =>
  request.run.projection === "out-of-date"
    ? [
        {
          scope: "projection",
          engine: request.engine,
          state: "out-of-date",
          file: request.run.projectionFile,
        },
      ]
    : [];

const problemOf = (request: {
  readonly catalogue: CatalogueEngines;
  readonly run: NamedEngineRun;
}): readonly RunProjectionProblem[] => {
  const engine = engineOf({ catalogue: request.catalogue, mechanism: request.run.mechanism });
  return [
    ...projectionProblemOf({ engine, run: request.run }),
    ...request.run.slices.map((problem): RunProjectionProblem =>
      problem.state === "left-over"
        ? { ...problem, scope: "file", engine }
        : { ...problem, scope: "slice", engine },
    ),
  ];
};

export const engineUnmeasuredOf = (request: {
  readonly catalogue: CatalogueEngines;
  readonly runs: readonly NamedEngineRun[];
  readonly selected: readonly Selected[];
  readonly tracked: readonly RepoPath[];
}): readonly EngineNotRun[] =>
  request.runs.flatMap((run) =>
    notRunOf({
      catalogue: request.catalogue,
      run,
      selected: request.selected,
      tracked: request.tracked,
    }),
  );

export const engineProblemsOf = (request: {
  readonly catalogue: CatalogueEngines;
  readonly runs: readonly NamedEngineRun[];
}): readonly RunProjectionProblem[] =>
  request.runs.flatMap((run) => problemOf({ catalogue: request.catalogue, run }));

type RefreshableProjection = RunProjectionProblem | MissingProjection;

const refreshableProblemOf = (request: {
  readonly problem: RunProjectionProblem;
}): RefreshableProjection | undefined => {
  const { problem } = request;
  switch (problem.scope) {
    case "projection":
    case "file":
      return problem;
    case "slice":
      switch (problem.state) {
        case "out-of-date":
        case "missing":
          return problem;
        case "not-included":
        case "unconfigured":
          return undefined;
      }
  }
};

const refreshableUnmeasuredOf = (request: {
  readonly unmeasured: RunUnmeasured;
}): RefreshableProjection | undefined => {
  const { unmeasured } = request;
  if (unmeasured.kind !== "engine-not-run") {
    return undefined;
  }
  switch (unmeasured.projection) {
    case "missing":
      return unmeasured;
    case "not-included":
    case "measured-nothing":
      return undefined;
  }
};

export const refreshableProjectionOf = (request: {
  readonly problems: readonly RunProjectionProblem[];
  readonly unmeasured: readonly RunUnmeasured[];
}): RefreshableProjection | undefined =>
  request.unmeasured
    .map((unmeasured) => refreshableUnmeasuredOf({ unmeasured }))
    .concat(request.problems.map((problem) => refreshableProblemOf({ problem })))
    .find((refreshable) => refreshable !== undefined);

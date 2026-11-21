import { z } from "zod";
import { runMechanism } from "./mechanism-dispatch.ts";
import type { MechanismRun } from "../../../../domain/runner/mechanism-run.ts";
import type { ClauseBinding } from "../../../../domain/settings/selection/selection.ts";
import { checksProjectResultSchema, checksRunnerModuleSchema, checksRunResultSchema } from "../checks/checks-runner-module-schema.ts";
import type { ChecksRunFailure, ChecksRunReport } from "../checks/checks-runner-types.ts";
import type { ChecksRunRequest, LoadedRunner, LoadedStandaloneRunner } from "../../../../application/ports/engine/runner-module.ts";
import type { ChecksSliceProblem, MisnamedRuleId, ProjectedFile } from "../../../../domain/runner/checks-run-report.ts";
import { rejectedCall, type RunnerFailure, runnerInvalidOutput } from "../../../../domain/runner/runner-failure.ts";
import type { RunnerInvalid } from "./load-runner.ts";
import { runnerModuleSchema } from "../runner-module/runner-module-schema.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../application/ports/host/path-port.ts";
import { clauseAddressText, sameClauseAddress } from "../../../../domain/rule-set/clause-address.ts";
import type { AbsolutePath } from "../../../../domain/repository/absolute-path-types.ts";
import type { MechanismId } from "../../../../domain/rule-set/identifier-types.ts";
import { runnerModuleSegmentsOf } from "../../../node/modules/install-layout.ts";
import type { ModuleExtension } from "../../../../application/ports/host/module-extension.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import { reportedChecksRefusal } from "../../../../domain/language-layer/reported-checks.ts";
import type { RunFailureSource } from "../../../../domain/report/run-failure.ts";

type ParsedChecksRunner = z.output<typeof checksRunnerModuleSchema>;

export type EngineRun = Omit<MechanismRun, "slices"> & { readonly slices: readonly ChecksSliceProblem[]; readonly misnamedRuleIds: readonly MisnamedRuleId[] };

export type LoadedEngine = {
  readonly mechanism: MechanismId;
  readonly runner: LoadedRunner;
  readonly checksRunner: ParsedChecksRunner | undefined;
};

export type EngineRunRequest = Omit<ChecksRunRequest, "bindings"> & { readonly bindings: readonly ClauseBinding[] };

type Outcome<Value> = Result<Value, RunFailureSource>;

const TYPESCRIPT_RUNNER_MODULE = z.object({ runner: runnerModuleSchema, checksRunner: checksRunnerModuleSchema.optional() });

const NO_CHECKS_RUNNER_DETAIL = "the runner module exports no checksRunner, which a version 2 run needs of an engine that runs through a native tool";

const invalid = (request: { readonly mechanism: MechanismId; readonly detail: string }): Result<never, RunnerInvalid> => ({
  outcome: "failed",
  error: { kind: "runner-invalid", mechanism: request.mechanism, detail: request.detail },
});

const runnerFailed = (request: { readonly mechanism: MechanismId; readonly failure: RunnerFailure }): Outcome<never> => ({
  outcome: "failed",
  error: { kind: "runner-failed", mechanism: request.mechanism, failure: request.failure },
});

export const loadedEngineOf = async (request: {
  readonly mechanism: MechanismId;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly path: Pick<PathPort, "join">;
  readonly modules: ModuleLoaderPort;
}): Promise<Result<LoadedEngine, RunnerInvalid>> => {
  const loaded = await request.modules.load({
    path: request.path.join({
      segments: runnerModuleSegmentsOf({ installRoot: request.installRoot, mechanism: request.mechanism, moduleExtension: request.moduleExtension }),
    }),
  });
  if (loaded.outcome === "failed") {
    return invalid({ mechanism: request.mechanism, detail: loaded.error.detail });
  }
  const parsed = TYPESCRIPT_RUNNER_MODULE.safeParse(loaded.value);
  return parsed.success
    ? { outcome: "ok", value: { mechanism: request.mechanism, runner: parsed.data.runner, checksRunner: parsed.data.checksRunner } }
    : invalid({ mechanism: request.mechanism, detail: z.prettifyError(parsed.error) });
};

const clausesOf = (request: { readonly request: EngineRunRequest; readonly mechanism: MechanismId }) =>
  request.request.bindings.filter((binding) => binding.mechanism === request.mechanism).map((binding) => binding.clause);

const standaloneRunOf = async (request: { readonly runner: LoadedStandaloneRunner; readonly mechanism: MechanismId; readonly run: EngineRunRequest }): Promise<Outcome<EngineRun>> => {
  const ran = await runMechanism({
    runner: request.runner,
    mechanism: request.mechanism,
    run: {
      repoRoot: request.run.repoRoot,
      installRoot: request.run.installRoot,
      files: request.run.files,
      trackedPaths: request.run.trackedPaths,
      clauses: clausesOf({ request: request.run, mechanism: request.mechanism }),
    },
  });
  return ran.outcome === "failed" ? runnerFailed({ mechanism: request.mechanism, failure: ran.error }) : { outcome: "ok", value: { ...ran.value, slices: [], misnamedRuleIds: [] } };
};

type Filed = { readonly clause: ChecksRunRequest["bindings"][number]["clause"]["address"]; readonly file: RepoPath };

const unrequestedDetail = (request: {
  readonly noun: string;
  readonly entries: readonly Filed[];
  readonly files: readonly RepoPath[];
  readonly clauses: readonly Filed["clause"][];
}): readonly string[] => {
  const entry = request.entries.find(
    (candidate) =>
      !request.files.includes(candidate.file) || !request.clauses.some((clause) => sameClauseAddress({ left: clause, right: candidate.clause }) === "same"),
  );
  return entry === undefined ? [] : [`${request.noun} names ${clauseAddressText({ address: entry.clause })} in ${entry.file}, which the request did not hold`];
};

const unrequestedNativeDetail = (request: { readonly report: ChecksRunReport; readonly clauses: readonly Filed["clause"][] }): readonly string[] => {
  const entry = request.report.nativeExceptions.find((native) => !request.clauses.some((clause) => sameClauseAddress({ left: clause, right: native.clause }) === "same"));
  return entry === undefined ? [] : [`a native exception names ${clauseAddressText({ address: entry.clause })}, which the request did not hold`];
};

const invalidReport = (request: { readonly report: ChecksRunReport; readonly run: EngineRunRequest; readonly mechanism: MechanismId }): readonly string[] => {
  const clauses = clausesOf({ request: request.run, mechanism: request.mechanism }).map((clause) => clause.address);
  return [
    ...unrequestedDetail({ noun: "a hit", entries: request.report.hits, files: request.run.files, clauses }),
    ...unrequestedDetail({ noun: "a measured pair", entries: request.report.measured, files: request.run.files, clauses }),
    ...unrequestedNativeDetail({ report: request.report, clauses }),
  ];
};

const engineRunOfReport = (request: {
  readonly report: ChecksRunReport;
  readonly run: EngineRunRequest;
  readonly mechanism: MechanismId;
  readonly projectedKinds: ParsedChecksRunner["projectedKinds"];
}): Outcome<EngineRun> => {
  const [unrequested] = invalidReport(request);
  if (unrequested !== undefined) {
    return runnerFailed({ mechanism: request.mechanism, failure: runnerInvalidOutput({ detail: unrequested }).error });
  }
  const refusal = reportedChecksRefusal({ catalogue: { checks: request.run.checks }, reported: [...request.report.hits, ...request.report.nativeExceptions] });
  if (refusal.outcome === "failed") {
    return runnerFailed({ mechanism: request.mechanism, failure: refusal.error });
  }
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      hits: request.report.hits,
      nativeExceptions: request.report.nativeExceptions,
      coverableKinds: request.projectedKinds,
      projection: request.report.projection,
      slices: request.report.slices,
      unprojectedFolders: [],
      measured: request.report.measured,
      misnamedRuleIds: request.report.misnamedRuleIds,
    },
  };
};

type ChecksCall = { readonly checksRunner: ParsedChecksRunner; readonly mechanism: MechanismId; readonly run: EngineRunRequest };

const returnedBy = (request: { readonly call: () => Promise<unknown> }): Promise<unknown> =>
  Promise.resolve()
    .then(request.call)
    .catch((thrown: unknown) => ({ outcome: "failed", error: rejectedCall({ thrown }).error }));

const invalidChecksOutput = (request: { readonly mechanism: MechanismId; readonly error: z.ZodError }): Outcome<never> =>
  runnerFailed({ mechanism: request.mechanism, failure: runnerInvalidOutput({ detail: z.prettifyError(request.error) }).error });

const failedChecksCall = (request: { readonly mechanism: MechanismId; readonly error: ChecksRunFailure }): Outcome<never> =>
  request.error.kind === "not-ready-yet" ? { outcome: "failed", error: request.error } : runnerFailed({ mechanism: request.mechanism, failure: request.error });

const checksRunOf = async (request: ChecksCall): Promise<Outcome<EngineRun>> => {
  const parsed = checksRunResultSchema.safeParse(await returnedBy({ call: () => request.checksRunner.run(request.run) }));
  if (!parsed.success) {
    return invalidChecksOutput({ mechanism: request.mechanism, error: parsed.error });
  }
  if (parsed.data.outcome === "failed") {
    return failedChecksCall({ mechanism: request.mechanism, error: parsed.data.error });
  }
  return engineRunOfReport({ report: parsed.data.value, run: request.run, mechanism: request.mechanism, projectedKinds: request.checksRunner.projectedKinds });
};

const checksProjectionOf = async (request: ChecksCall): Promise<Outcome<readonly ProjectedFile[]>> => {
  const parsed = checksProjectResultSchema.safeParse(await returnedBy({ call: () => request.checksRunner.project(request.run) }));
  if (!parsed.success) {
    return invalidChecksOutput({ mechanism: request.mechanism, error: parsed.error });
  }
  return parsed.data.outcome === "failed" ? failedChecksCall({ mechanism: request.mechanism, error: parsed.data.error }) : parsed.data;
};

export const engineRunOf = (request: { readonly engine: LoadedEngine; readonly request: EngineRunRequest }): Promise<Outcome<EngineRun>> => {
  const { engine } = request;
  if (engine.runner.exceptionPath === "standalone") {
    return standaloneRunOf({ runner: engine.runner, mechanism: engine.mechanism, run: request.request });
  }
  return engine.checksRunner === undefined
    ? Promise.resolve(invalid({ mechanism: engine.mechanism, detail: NO_CHECKS_RUNNER_DETAIL }))
    : checksRunOf({ checksRunner: engine.checksRunner, mechanism: engine.mechanism, run: request.request });
};

export const engineProjectionOf = (request: { readonly engine: LoadedEngine; readonly request: EngineRunRequest }): Promise<Outcome<readonly ProjectedFile[]>> => {
  const { engine } = request;
  if (engine.runner.exceptionPath === "standalone") {
    return Promise.resolve({ outcome: "ok", value: [] });
  }
  return engine.checksRunner === undefined
    ? Promise.resolve(invalid({ mechanism: engine.mechanism, detail: NO_CHECKS_RUNNER_DETAIL }))
    : checksProjectionOf({ checksRunner: engine.checksRunner, mechanism: engine.mechanism, run: request.request });
};

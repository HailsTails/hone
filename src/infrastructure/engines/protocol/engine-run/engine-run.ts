import { z } from "zod";

import type {
  NamedEnginePort,
  NamedEngineLocation,
  NamedEngineFailure,
} from "../../../../application/ports/engine/engine-port.ts";
import type {
  NamedEngineRun,
  NamedEngineRunRequest,
  NamedEslintRunRequest,
} from "../../../../application/ports/engine/engine-run.ts";
import type {
  RunnerInvalid,
  RunnerLocation,
  RunnerModuleOf,
} from "../../../../application/ports/engine/runner-location.ts";
import type {
  CheckedVersionOneProjection,
  MeasureVersionOneProjection,
} from "../../../../application/ports/upgrade/version-one-measurement.ts";
import type { Result } from "../../../../domain/result.ts";
import type { EngineId } from "../../../../domain/rule-set/identifier-types.ts";
import { checkedObservations } from "../../../../domain/runner/checked-observations.ts";
import type { ProjectionEntry } from "../../../../domain/runner/checks-run-report.ts";
import {
  rejectedCall,
  type RunnerFailure,
  runnerInvalidOutput,
} from "../../../../domain/runner/runner-failure.ts";
import {
  checksProjectResultSchema,
  measurementResultSchema,
  namedChecksRunReportSchema,
  namedChecksRunResultSchema,
  namedChecksRunnerModuleSchema,
} from "../checks/checks-runner-module-schema.ts";
import { runnerCallSchema } from "../runner-module/runner-module-schema.ts";
type NamedOutcome<Value> = Result<Value, NamedEngineFailure>;

const invalid = (request: {
  readonly mechanism: EngineId;
  readonly detail: string;
}): Result<never, RunnerInvalid> => ({
  outcome: "failed",
  error: { kind: "runner-invalid", mechanism: request.mechanism, detail: request.detail },
});

const runnerFailed = (request: {
  readonly mechanism: EngineId;
  readonly failure: RunnerFailure;
}): NamedOutcome<never> => ({
  outcome: "failed",
  error: { kind: "runner-failed", mechanism: request.mechanism, failure: request.failure },
});

type RunnerModulePorts = { readonly runnerModuleOf: RunnerModuleOf };

const returnedBy = (request: { readonly call: () => Promise<unknown> }): Promise<unknown> =>
  Promise.resolve()
    .then(request.call)
    .catch((thrown: unknown) => ({ outcome: "failed", error: rejectedCall({ thrown }).error }));

const invalidChecksOutput = (request: {
  readonly mechanism: EngineId;
  readonly error: z.ZodError;
}): NamedOutcome<never> =>
  runnerFailed({
    mechanism: request.mechanism,
    failure: runnerInvalidOutput({ detail: z.prettifyError(request.error) }).error,
  });

const NAMED_RUNNER_MODULE = z.object({ namedChecksRunner: namedChecksRunnerModuleSchema });

type ParsedNamedRunner = z.output<typeof namedChecksRunnerModuleSchema>;

type NamedEngineCall = {
  readonly mechanism: EngineId;
  readonly runner: ParsedNamedRunner;
  readonly request: NamedEngineRunRequest | NamedEslintRunRequest;
};

export const createRunnerLoader =
  (ports: RunnerModulePorts) =>
  async (request: RunnerLocation): Promise<Result<ParsedNamedRunner, RunnerInvalid>> => {
    const loaded = await ports.runnerModuleOf(request);
    if (loaded.outcome === "failed")
      return invalid({ mechanism: request.mechanism, detail: loaded.error.detail });
    const parsed = NAMED_RUNNER_MODULE.safeParse(loaded.value);
    return parsed.success
      ? { outcome: "ok", value: parsed.data.namedChecksRunner }
      : invalid({ mechanism: request.mechanism, detail: z.prettifyError(parsed.error) });
  };

const mapCallToRunnerRequest = (call: NamedEngineCall): NamedEngineRunRequest => ({
  ...call.request,
  bindings: call.request.bindings.filter(({ engine }) => engine === call.mechanism),
});

const verifiedNamedRun = (request: {
  readonly call: NamedEngineCall;
  readonly requested: NamedEngineRunRequest;
  readonly report: z.output<typeof namedChecksRunReportSchema>;
}): NamedOutcome<NamedEngineRun> => {
  const { call, requested, report } = request;
  const files = call.runner.fileScope === "tracked" ? requested.trackedPaths : requested.files;
  const checked = checkedObservations({ requested: { ...requested, files }, report });
  return checked.outcome === "failed"
    ? runnerFailed({ mechanism: call.mechanism, failure: checked.error })
    : {
        outcome: "ok",
        value: {
          ...checked.value,
          mechanism: call.mechanism,
          coverableKinds: call.runner.projectedKinds,
        },
      };
};

const runNamedEngine = async (call: NamedEngineCall): Promise<NamedOutcome<NamedEngineRun>> => {
  const requested = mapCallToRunnerRequest(call);
  const parsed = namedChecksRunResultSchema.safeParse(
    await returnedBy({ call: () => call.runner.run(requested) }),
  );
  if (!parsed.success) {
    return invalidChecksOutput({ mechanism: call.mechanism, error: parsed.error });
  }
  if (parsed.data.outcome === "failed") {
    return runnerFailed({ mechanism: call.mechanism, failure: parsed.data.error });
  }
  return verifiedNamedRun({ call, requested, report: parsed.data.value });
};

const versionOneMeasurementModuleSchema = z.object({
  measureVersionOne: runnerCallSchema.optional(),
});

const measureNamedRun = async (call: NamedEngineCall): ReturnType<MeasureVersionOneProjection> => {
  const request: NamedEngineRunRequest | NamedEslintRunRequest =
    call.mechanism === "eslint" ? { ...call.request, projectionKind: "mjs" } : call.request;
  const report = await runNamedEngine({ ...call, request });
  return report.outcome === "failed"
    ? report
    : { outcome: "ok", value: { report: report.value, unappliedSlices: [] } };
};

const measuredVersionOne = async (
  request: RunnerModulePorts & {
    readonly call: NamedEngineCall;
    readonly location: RunnerLocation;
    readonly projection: CheckedVersionOneProjection | undefined;
  },
): ReturnType<MeasureVersionOneProjection> => {
  const { call, location, projection } = request;
  if (projection === undefined) return measureNamedRun(call);
  const loaded = await request.runnerModuleOf(location);
  if (loaded.outcome === "failed")
    return invalid({ mechanism: call.mechanism, detail: loaded.error.detail });
  const module = versionOneMeasurementModuleSchema.safeParse(loaded.value);
  if (!module.success)
    return invalid({ mechanism: call.mechanism, detail: z.prettifyError(module.error) });
  const measureVersionOne = module.data.measureVersionOne;
  if (measureVersionOne === undefined) return measureNamedRun(call);
  const requested = mapCallToRunnerRequest(call);
  const parsed = measurementResultSchema.safeParse(
    await returnedBy({ call: () => measureVersionOne({ run: requested, projection }) }),
  );
  if (!parsed.success)
    return invalidChecksOutput({ mechanism: call.mechanism, error: parsed.error });
  if (parsed.data.outcome === "failed") {
    return runnerFailed({ mechanism: call.mechanism, failure: parsed.data.error });
  }
  const allowedSlices = new Set(projection.packageFiles);
  const unrequested = parsed.data.value.unappliedSlices.find((slice) => !allowedSlices.has(slice));
  if (unrequested !== undefined) {
    return runnerFailed({
      mechanism: call.mechanism,
      failure: runnerInvalidOutput({
        detail: `unrequested version one projection slice ${unrequested}`,
      }).error,
    });
  }
  const report = verifiedNamedRun({ call, requested, report: parsed.data.value.report });
  return report.outcome === "failed"
    ? report
    : {
        outcome: "ok",
        value: { report: report.value, unappliedSlices: parsed.data.value.unappliedSlices },
      };
};

const projectNamedEngine = async (
  call: NamedEngineCall,
): Promise<NamedOutcome<readonly ProjectionEntry[]>> => {
  const parsed = checksProjectResultSchema.safeParse(
    await returnedBy({ call: () => call.runner.project(mapCallToRunnerRequest(call)) }),
  );
  if (!parsed.success) {
    return invalidChecksOutput({ mechanism: call.mechanism, error: parsed.error });
  }
  return parsed.data.outcome === "failed"
    ? runnerFailed({ mechanism: call.mechanism, failure: parsed.data.error })
    : parsed.data;
};

export const measureVersionOneProjectionOver = (
  ports: RunnerModulePorts,
): MeasureVersionOneProjection => {
  const load = createRunnerLoader(ports);
  return async ({ request, location, projection }) => {
    const runner = await load(location);
    if (runner.outcome === "failed") return runner;
    return measuredVersionOne({
      ...ports,
      call: { mechanism: location.mechanism, runner: runner.value, request },
      location,
      projection,
    });
  };
};

const bindRunner = (location: NamedEngineLocation, runner: ParsedNamedRunner) => {
  const { mechanism } = location;
  const createCall = (request: NamedEngineRunRequest): NamedEngineCall => ({
    mechanism,
    runner,
    request:
      location.mechanism === "eslint"
        ? { ...request, projectionKind: location.projectionKind }
        : request,
  });
  return {
    run: (request: NamedEngineRunRequest) => runNamedEngine(createCall(request)),
    project: (request: NamedEngineRunRequest) => projectNamedEngine(createCall(request)),
  };
};

export const createNamedEnginePort = (ports: RunnerModulePorts): NamedEnginePort => {
  const load = createRunnerLoader(ports);
  return {
    load: async (location) => {
      const { mechanism, installRoot, moduleExtension, modules, path } = location;
      const runner = await load({ mechanism, installRoot, moduleExtension, modules, path });
      if (runner.outcome === "failed") return runner;
      return { outcome: "ok", value: bindRunner(location, runner.value) };
    },
  };
};

import { z } from "zod";

import type {
  NamedEngineCall,
  NamedEngineFailure,
} from "../../../../application/ports/engine/engine-port.ts";
import type {
  NamedEngineRun,
  NamedEngineRunRequest,
  ParsedNamedRunner,
} from "../../../../application/ports/engine/engine-run.ts";
import type {
  RunnerInvalid,
  RunnerLocation,
} from "../../../../application/ports/engine/runner-location.ts";
import type { MeasureVersionOneProjection } from "../../../../application/ports/upgrade/version-one-measurement.ts";
import type { Result } from "../../../../domain/result.ts";
import type { EngineId } from "../../../../domain/rule-set/identifier-types.ts";
import { checkedObservations } from "../../../../domain/runner/checked-observations.ts";
import type { ProjectedFile } from "../../../../domain/runner/checks-run-report.ts";
import {
  rejectedCall,
  type RunnerFailure,
  runnerInvalidOutput,
} from "../../../../domain/runner/runner-failure.ts";
import { runnerModuleSegmentsOf } from "../../../node/modules/install-layout.ts";
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

const runnerModuleAt = (request: RunnerLocation) =>
  request.modules.load({
    path: request.path.join({
      segments: runnerModuleSegmentsOf({
        installRoot: request.installRoot,
        mechanism: request.mechanism,
        moduleExtension: request.moduleExtension,
      }),
    }),
  });

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

export const loadedNamedRunnerOf = async (
  request: RunnerLocation,
): Promise<Result<ParsedNamedRunner, RunnerInvalid>> => {
  const loaded = await runnerModuleAt(request);
  if (loaded.outcome === "failed")
    return invalid({ mechanism: request.mechanism, detail: loaded.error.detail });
  const parsed = NAMED_RUNNER_MODULE.safeParse(loaded.value);
  return parsed.success
    ? { outcome: "ok", value: parsed.data.namedChecksRunner }
    : invalid({ mechanism: request.mechanism, detail: z.prettifyError(parsed.error) });
};

const namedRequestOf = (call: NamedEngineCall): NamedEngineRunRequest => ({
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

export const namedEngineRunOf = async (
  call: NamedEngineCall,
): Promise<NamedOutcome<NamedEngineRun>> => {
  const requested = namedRequestOf(call);
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
  const report = await namedEngineRunOf(call);
  return report.outcome === "failed"
    ? report
    : { outcome: "ok", value: { report: report.value, unappliedSlices: [] } };
};

export const measureVersionOneProjection: MeasureVersionOneProjection = async ({
  call,
  location,
  projection,
}) => {
  if (projection === undefined) return measureNamedRun(call);
  const loaded = await runnerModuleAt(location);
  if (loaded.outcome === "failed")
    return invalid({ mechanism: call.mechanism, detail: loaded.error.detail });
  const module = versionOneMeasurementModuleSchema.safeParse(loaded.value);
  if (!module.success)
    return invalid({ mechanism: call.mechanism, detail: z.prettifyError(module.error) });
  const measureVersionOne = module.data.measureVersionOne;
  if (measureVersionOne === undefined) return measureNamedRun(call);
  const requested = namedRequestOf(call);
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

export const namedEngineProjectionOf = async (
  call: NamedEngineCall,
): Promise<NamedOutcome<readonly ProjectedFile[]>> => {
  const parsed = checksProjectResultSchema.safeParse(
    await returnedBy({ call: () => call.runner.project(namedRequestOf(call)) }),
  );
  if (!parsed.success) {
    return invalidChecksOutput({ mechanism: call.mechanism, error: parsed.error });
  }
  return parsed.data.outcome === "failed"
    ? runnerFailed({ mechanism: call.mechanism, failure: parsed.data.error })
    : parsed.data;
};

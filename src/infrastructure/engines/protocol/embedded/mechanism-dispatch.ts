import { z } from "zod";
import { embeddedRunReportSchema } from "./embedded-run-report-schema.ts";
import { type RunnerFailure, rejectedCall, runnerInvalidOutput } from "../../../../domain/runner/runner-failure.ts";
import type { RunRequest } from "../../../../application/ports/engine/runner-module.ts";
import type { MechanismProjectionRequest, MechanismRequest } from "../../../../application/ports/engine/mechanism-request.ts";
import { projectionWriteSchema, runnerResultSchema } from "../runner-module/runner-result-schema.ts";
import type { NativeException, ProjectionWrite } from "../../../../domain/runner/runner-result-types.ts";
import { firstUnrequestedDetail, NOTHING_MEASURED, runMechanism as runStandaloneMechanism, unrequestedNativeException } from "../engine-run/mechanism-dispatch.ts";
import type { MechanismRun } from "../../../../domain/runner/mechanism-run.ts";
import { clauseAddressText } from "../../../../domain/rule-set/clause-address.ts";
import type { MechanismId } from "../../../../domain/rule-set/identifier-types.ts";
import type { Result } from "../../../../domain/result.ts";

const reportResultSchema = runnerResultSchema({ value: embeddedRunReportSchema });

const projectionWriteResultSchema = runnerResultSchema({ value: z.array(projectionWriteSchema).readonly() });

const embeddedRun = (request: {
  readonly returned: unknown;
  readonly mechanism: MechanismId;
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly run: RunRequest;
}): Result<MechanismRun, RunnerFailure> => {
  const parsed = reportResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const report = parsed.data.value;
  const unrequested = firstUnrequestedDetail({
    groups: [
      { noun: "a hit", entries: report.hits },
      { noun: "a measured pair", entries: report.measured ?? NOTHING_MEASURED },
    ],
    run: request.run,
    checkedFiles: request.run.files,
  });
  if (unrequested !== undefined) {
    return runnerInvalidOutput({ detail: unrequested });
  }
  const unrequestedNative = unrequestedNativeException({
    nativeExceptions: report.nativeExceptions,
    run: request.run,
  });
  if (unrequestedNative !== undefined) {
    return runnerInvalidOutput({
      detail: `a native exception names ${clauseAddressText({ address: unrequestedNative.clause })}, which the request did not hold`,
    });
  }
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      hits: report.hits,
      nativeExceptions: report.nativeExceptions,
      coverableKinds: request.projectedKinds,
      projection: report.projection,
      slices: report.slices,
      unprojectedFolders: report.unprojectedFolders,
      measured: report.measured ?? NOTHING_MEASURED,
    },
  };
};

const embeddedProjection = (request: {
  readonly returned: unknown;
}): Result<readonly ProjectionWrite[], RunnerFailure> => {
  const parsed = projectionWriteResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  return parsed.data;
};

export const runMechanismWithRecords = (
  request: MechanismRequest,
): Promise<Result<MechanismRun, RunnerFailure>> => {
  switch (request.runner.exceptionPath) {
    case "standalone":
      return runStandaloneMechanism({ runner: request.runner, mechanism: request.mechanism, run: request.run });
    case "embedded": {
      const runner = request.runner;
      return Promise.resolve()
        .then(() =>
          runner.run({ ...request.run, declaredConfigRoots: request.declaredConfigRoots, records: request.records }),
        )
        .then(
          (returned) =>
            embeddedRun({
              returned,
              mechanism: request.mechanism,
              projectedKinds: runner.projectedKinds,
              run: request.run,
            }),
          (thrown: unknown) => rejectedCall({ thrown }),
        );
    }
  }
};

export const projectMechanism = (
  request: MechanismProjectionRequest,
): Promise<Result<readonly ProjectionWrite[], RunnerFailure>> => {
  switch (request.runner.exceptionPath) {
    case "standalone": {
      return Promise.resolve({ outcome: "ok", value: [] });
    }
    case "embedded": {
      const runner = request.runner;
      return Promise.resolve()
        .then(() => runner.project(request.request))
        .then(
          (returned) => embeddedProjection({ returned }),
          (thrown: unknown) => rejectedCall({ thrown }),
        );
    }
  }
};

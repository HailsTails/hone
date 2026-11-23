import { z } from "zod";

import type {
  LoadedStandaloneRunner,
  RunRequest,
} from "../../../../application/ports/engine/runner-module.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import { sameClauseAddress } from "../../../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../../../domain/rule-set/identifier-types.ts";
import type { MechanismRun } from "../../../../domain/runner/mechanism-run.ts";
import {
  type RunnerFailure,
  rejectedCall,
  runnerInvalidOutput,
} from "../../../../domain/runner/runner-failure.ts";
import type {
  MeasuredPair,
  NativeException,
} from "../../../../domain/runner/runner-result-types.ts";
import { runnerResultSchema } from "../runner-module/runner-result-schema.ts";
import { standaloneRunReportSchema } from "../runner-module/standalone-run-report-schema.ts";
import { type FiledClause, requestHeldOf, unrequestedDetailOf } from "./unrequested-entries.ts";

const STANDALONE_COVERABLE_KINDS: readonly NativeException["kind"][] = ["inline-disable"];

export const NOTHING_MEASURED: readonly MeasuredPair[] = [];

const standaloneResultSchema = runnerResultSchema({ value: standaloneRunReportSchema });

type FiledGroup = {
  readonly noun: string;
  readonly entries: readonly FiledClause[];
};

export const firstUnrequestedDetail = (request: {
  readonly groups: readonly FiledGroup[];
  readonly run: RunRequest;
  readonly checkedFiles: readonly RepoPath[];
}): string | undefined => {
  const held = requestHeldOf({
    files: request.checkedFiles,
    clauses: request.run.clauses.map((clause) => clause.address),
  });
  return request.groups.flatMap((group) =>
    unrequestedDetailOf({ noun: group.noun, entries: group.entries, held }),
  )[0];
};

const okOutcomeSchema = z.object({ outcome: z.literal("ok") });

const okStandaloneSchema = z.object({ outcome: z.literal("ok"), value: standaloneRunReportSchema });

const invalidStandaloneDetail = (request: {
  readonly returned: unknown;
  readonly error: z.ZodError;
}): string => {
  if (!okOutcomeSchema.safeParse(request.returned).success) {
    return z.prettifyError(request.error);
  }
  const report = okStandaloneSchema.safeParse(request.returned);
  return z.prettifyError(report.success ? request.error : report.error);
};

const standaloneRun = (request: {
  readonly returned: unknown;
  readonly mechanism: EngineId;
  readonly run: RunRequest;
}): Result<MechanismRun, RunnerFailure> => {
  const parsed = standaloneResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({
      detail: invalidStandaloneDetail({ returned: request.returned, error: parsed.error }),
    });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const report = parsed.data.value;
  const unrequested = firstUnrequestedDetail({
    groups: [
      { noun: "a hit", entries: report.hits },
      { noun: "a native exception", entries: report.nativeExceptions },
      { noun: "a measured pair", entries: report.measured ?? NOTHING_MEASURED },
    ],
    run: request.run,
    checkedFiles: request.run.trackedPaths,
  });
  if (unrequested !== undefined) {
    return runnerInvalidOutput({ detail: unrequested });
  }
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      hits: report.hits,
      nativeExceptions: report.nativeExceptions,
      coverableKinds: STANDALONE_COVERABLE_KINDS,
      projection: "none",
      slices: [],
      unprojectedFolders: [],
      measured: report.measured ?? NOTHING_MEASURED,
    },
  };
};

export const unrequestedNativeException = (request: {
  readonly nativeExceptions: readonly NativeException[];
  readonly run: RunRequest;
}): NativeException | undefined =>
  request.nativeExceptions.find(
    (nativeException) =>
      !request.run.clauses.some(
        (clause) =>
          sameClauseAddress({ left: clause.address, right: nativeException.clause }) === "same",
      ),
  );

export const runMechanism = (request: {
  readonly runner: LoadedStandaloneRunner;
  readonly mechanism: EngineId;
  readonly run: RunRequest;
}): Promise<Result<MechanismRun, RunnerFailure>> => {
  const { runner } = request;
  return Promise.resolve()
    .then(() => runner.run(request.run))
    .then(
      (returned) => standaloneRun({ returned, mechanism: request.mechanism, run: request.run }),
      (thrown: unknown) => rejectedCall({ thrown }),
    );
};

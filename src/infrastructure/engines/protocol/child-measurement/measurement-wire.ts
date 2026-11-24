import { z } from "zod";

import type { NamedEngineRun } from "../../../../application/ports/engine/engine-run.ts";
import type { ProcessPort } from "../../../../application/ports/host/process-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../domain/gathered-outcomes.ts";
import type { RunLoadFailure } from "../../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import type { EngineId } from "../../../../domain/rule-set/identifier-types.ts";
import { runnerInvalidOutput } from "../../../../domain/runner/runner-failure.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { parsedJson } from "../../../content-files/parsed-json.ts";
import { engineIdSchema } from "../../../hone-config-file/identifiers.ts";
import { namedChecksRunResultSchema } from "../checks/checks-runner-module-schema.ts";
import { nativeExceptionKindSchema } from "../runner-module/runner-result-schema.ts";
import type { DeepReadonly, Equal } from "../runner-module/type-equality.ts";
import { runLoadFailureSchema } from "./run-load-failure-schema.ts";

export type MeasurementArguments = {
  readonly installRoot: AbsolutePath;
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
};

type MeasuredRuns = Result<readonly NamedEngineRun[], RunLoadFailure>;

export type MeasureEngines = (measuring: MeasurementArguments) => Promise<MeasuredRuns>;

const measurementArgumentsSchema = z
  .tuple([absolutePathSchema, absolutePathSchema, z.string().min(1).optional()])
  .transform(([installRoot, repoRoot, baseRevision]) => ({ installRoot, repoRoot, baseRevision }));

export const isMeasurementArgumentsSchemaEqual: Equal<
  DeepReadonly<z.output<typeof measurementArgumentsSchema>>,
  MeasurementArguments
> = true;

const engineReplySchema = z.strictObject({
  coverableKinds: z.array(nativeExceptionKindSchema).readonly(),
  result: namedChecksRunResultSchema,
});

const measurementReplySchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("measured"),
    engines: z.partialRecord(engineIdSchema, z.unknown()),
  }),
  z.strictObject({ outcome: z.literal("not-loaded"), failure: runLoadFailureSchema }),
]);

type MeasurementReply = z.output<typeof measurementReplySchema>;

export const createMeasurementArguments = (request: MeasurementArguments): readonly string[] =>
  request.baseRevision === undefined
    ? [request.installRoot, request.repoRoot]
    : [request.installRoot, request.repoRoot, request.baseRevision];

const mapRunToEngineReply = (request: {
  readonly run: NamedEngineRun;
}): z.input<typeof engineReplySchema> => ({
  coverableKinds: request.run.coverableKinds,
  result: {
    outcome: "ok",
    value: {
      slices: request.run.slices,
      nestedConfigurations: request.run.nestedConfigurations,
      unprojectedFolders: request.run.unprojectedFolders,
      misnamedRuleIds: request.run.misnamedRuleIds,
      hits: request.run.hits,
      nativeExceptions: request.run.nativeExceptions,
      measured: request.run.measured,
      projection: request.run.projection,
    },
  },
});

const mapMeasuredToReply = (request: {
  readonly measured: MeasuredRuns;
}): z.input<typeof measurementReplySchema> =>
  request.measured.outcome === "failed"
    ? { outcome: "not-loaded", failure: request.measured.error }
    : {
        outcome: "measured",
        engines: Object.fromEntries(
          request.measured.value.map((run) => [run.mechanism, mapRunToEngineReply({ run })]),
        ),
      };

const readMeasured = async (request: {
  readonly process: ProcessPort;
  readonly measure: MeasureEngines;
}): Promise<MeasuredRuns> => {
  const measuring = measurementArgumentsSchema.safeParse(request.process.arguments);
  return measuring.success
    ? request.measure(measuring.data)
    : {
        outcome: "failed",
        error: { kind: "arguments-invalid", detail: z.prettifyError(measuring.error) },
      };
};

export const runEnginesMeasurement = async (request: {
  readonly process: ProcessPort;
  readonly measure: MeasureEngines;
}): Promise<void> => {
  const measured = await readMeasured(request);
  request.process.writeOut({ text: JSON.stringify(mapMeasuredToReply({ measured })) });
};

const decodeReply = (request: { readonly stdout: string }): Result<MeasurementReply, string> => {
  const parsed = parsedJson({ text: request.stdout });
  if (parsed.outcome === "failed") {
    return { outcome: "failed", error: `not JSON: ${parsed.error}` };
  }
  const reply = measurementReplySchema.safeParse(parsed.value);
  return reply.success
    ? { outcome: "ok", value: reply.data }
    : { outcome: "failed", error: z.prettifyError(reply.error) };
};

const createEngineFailure = (request: {
  readonly mechanism: EngineId;
  readonly failure: Extract<RunLoadFailure, { readonly kind: "engine-failed" }>["failure"];
}): Result<never, RunLoadFailure> => ({
  outcome: "failed",
  error: {
    kind: "engine-failed",
    engine: { named: "mechanism", mechanism: request.mechanism },
    failure: request.failure,
  },
});

const mapEntryToRun = (request: {
  readonly mechanism: EngineId;
  readonly entry: unknown;
}): Result<NamedEngineRun, RunLoadFailure> => {
  const { mechanism } = request;
  const decoded = engineReplySchema.safeParse(request.entry);
  if (!decoded.success) {
    return createEngineFailure({
      mechanism,
      failure: runnerInvalidOutput({ detail: z.prettifyError(decoded.error) }).error,
    });
  }
  const { coverableKinds, result: engineResult } = decoded.data;
  return engineResult.outcome === "failed"
    ? createEngineFailure({ mechanism, failure: engineResult.error })
    : { outcome: "ok", value: { ...engineResult.value, mechanism, coverableKinds } };
};

const mapReplyToRuns = (request: { readonly reply: MeasurementReply }): MeasuredRuns => {
  const { reply } = request;
  if (reply.outcome === "not-loaded") {
    return { outcome: "failed", error: reply.failure };
  }
  const { engines } = reply;
  return gatheredOutcomes({
    outcomes: engineIdSchema.options.flatMap((mechanism) =>
      engines[mechanism] === undefined
        ? []
        : [listedOutcome({ outcome: mapEntryToRun({ mechanism, entry: engines[mechanism] }) })],
    ),
  });
};

export const decodeMeasuredRuns = (request: {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}): MeasuredRuns => {
  const reply = decodeReply(request);
  return reply.outcome === "ok"
    ? mapReplyToRuns({ reply: reply.value })
    : {
        outcome: "failed",
        error: {
          kind: "unexpected-error",
          detail: `the measurement reply could not be decoded (exit status ${request.status}): ${reply.error}; error output: ${request.stderr}`,
        },
      };
};

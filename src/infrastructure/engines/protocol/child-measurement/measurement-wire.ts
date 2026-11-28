import { z } from "zod";

import type { NamedEngineRun } from "../../../../application/ports/engine/engine-run.ts";
import type { ProcessPort } from "../../../../application/ports/host/process-port.ts";
import type { ReplyPort } from "../../../../application/ports/host/reply-port.ts";
import type { RequestPort } from "../../../../application/ports/host/request-port.ts";
import type { RunLoadFailure } from "../../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../../../domain/repository/absolute-path-types.ts";
import type { CheckedTree } from "../../../../domain/repository/checked-tree.ts";
import type { Result } from "../../../../domain/result.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { parsedJson } from "../../../content-files/parsed-json.ts";
import { engineIdSchema } from "../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import {
  decodeUnscopedChecksReport,
  unscopedChecksRunReportSchema,
} from "../checks/checks-runner-module-schema.ts";
import { nativeExceptionKindSchema } from "../runner-module/runner-result-schema.ts";
import type { DeepReadonly, Equal } from "../runner-module/type-equality.ts";
import { runLoadFailureSchema } from "./run-load-failure-schema.ts";

export type MeasurementArguments = {
  readonly installRoot: AbsolutePath;
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
};

export type Measuring = MeasurementArguments & { readonly tree: CheckedTree };

type MeasuredRuns = Result<readonly NamedEngineRun[], RunLoadFailure>;

export type MeasureEngines = (measuring: Measuring) => Promise<MeasuredRuns>;

const measurementArgumentsSchema = z
  .tuple([absolutePathSchema, absolutePathSchema, z.string().min(1).optional()])
  .transform(([installRoot, repoRoot, baseRevision]) => ({ installRoot, repoRoot, baseRevision }));

export const isMeasurementArgumentsSchemaEqual: Equal<
  DeepReadonly<z.output<typeof measurementArgumentsSchema>>,
  MeasurementArguments
> = true;

const checkedTreeSchema = z.strictObject({
  tracked: z.array(repoPathSchema).readonly(),
  declaredConfigRoots: z.array(repoPathSchema).readonly(),
});

export const isCheckedTreeSchemaEqual: Equal<
  DeepReadonly<z.output<typeof checkedTreeSchema>>,
  CheckedTree
> = true;

const engineReplySchema = z.strictObject({
  mechanism: engineIdSchema,
  coverableKinds: z.array(nativeExceptionKindSchema).readonly(),
  report: unscopedChecksRunReportSchema,
  comparedOutputs: z.array(repoPathSchema).readonly(),
});

const measurementReplySchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("measured"), runs: z.array(engineReplySchema).readonly() }),
  z.strictObject({ outcome: z.literal("not-loaded"), failure: runLoadFailureSchema }),
]);

type MeasurementReply = z.output<typeof measurementReplySchema>;

export const createMeasurementArguments = (request: MeasurementArguments): readonly string[] =>
  request.baseRevision === undefined
    ? [request.installRoot, request.repoRoot]
    : [request.installRoot, request.repoRoot, request.baseRevision];

export const createMeasurementInput = (request: { readonly tree: CheckedTree }): string =>
  JSON.stringify(request.tree);

const mapRunToEngineReply = (request: {
  readonly run: NamedEngineRun;
}): z.input<typeof engineReplySchema> => {
  const {
    mechanism,
    coverableKinds,
    comparedOutputs,
    coverage: _coverage,
    ...report
  } = request.run;
  return {
    mechanism,
    coverableKinds,
    report:
      report.projection === "current-with-file" ? { ...report, projection: "current" } : report,
    comparedOutputs,
  };
};

const mapMeasuredToReply = (request: {
  readonly measured: MeasuredRuns;
}): z.input<typeof measurementReplySchema> =>
  request.measured.outcome === "failed"
    ? { outcome: "not-loaded", failure: request.measured.error }
    : {
        outcome: "measured",
        runs: request.measured.value.map((run) => mapRunToEngineReply({ run })),
      };

const decodeTree = (request: { readonly input: string }): Result<CheckedTree, string> => {
  const parsed = parsedJson({ text: request.input });
  if (parsed.outcome === "failed") {
    return { outcome: "failed", error: `the tree is not JSON: ${parsed.error}` };
  }
  const tree = checkedTreeSchema.safeParse(parsed.value);
  return tree.success
    ? { outcome: "ok", value: tree.data }
    : { outcome: "failed", error: z.prettifyError(tree.error) };
};

const decodeMeasuring = (request: {
  readonly arguments: readonly string[];
  readonly input: string;
}): Result<Measuring, string> => {
  const located = measurementArgumentsSchema.safeParse(request.arguments);
  if (!located.success) {
    return { outcome: "failed", error: z.prettifyError(located.error) };
  }
  const tree = decodeTree(request);
  return tree.outcome === "ok"
    ? { outcome: "ok", value: { ...located.data, tree: tree.value } }
    : tree;
};

const readMeasured = async (request: {
  readonly process: Pick<ProcessPort, "arguments">;
  readonly request: RequestPort;
  readonly measure: MeasureEngines;
}): Promise<MeasuredRuns> => {
  const measuring = decodeMeasuring({
    arguments: request.process.arguments,
    input: request.request.read(),
  });
  return measuring.outcome === "ok"
    ? request.measure(measuring.value)
    : { outcome: "failed", error: { kind: "arguments-invalid", detail: measuring.error } };
};

export const runEnginesMeasurement = async (request: {
  readonly process: Pick<ProcessPort, "arguments">;
  readonly request: RequestPort;
  readonly reply: ReplyPort;
  readonly measure: MeasureEngines;
}): Promise<void> => {
  const measured = await readMeasured(request);
  request.reply.write({ text: JSON.stringify(mapMeasuredToReply({ measured })) });
};

const decodeReply = (request: { readonly reply: string }): Result<MeasurementReply, string> => {
  const parsed = parsedJson({ text: request.reply });
  if (parsed.outcome === "failed") {
    return { outcome: "failed", error: `not JSON: ${parsed.error}` };
  }
  const reply = measurementReplySchema.safeParse(parsed.value);
  return reply.success
    ? { outcome: "ok", value: reply.data }
    : { outcome: "failed", error: z.prettifyError(reply.error) };
};

const mapReplyToRuns = (reply: MeasurementReply): MeasuredRuns =>
  reply.outcome === "not-loaded"
    ? { outcome: "failed", error: reply.failure }
    : {
        outcome: "ok",
        value: reply.runs.map(({ mechanism, coverableKinds, report, comparedOutputs }) => ({
          ...decodeUnscopedChecksReport(report),
          mechanism,
          coverableKinds,
          coverage: { kind: "scope-unavailable" },
          comparedOutputs,
        })),
      };

export const decodeMeasuredRuns = (request: {
  readonly status: number;
  readonly reply: string;
  readonly stderr: string;
}): MeasuredRuns => {
  const reply = decodeReply(request);
  return reply.outcome === "ok"
    ? mapReplyToRuns(reply.value)
    : {
        outcome: "failed",
        error: {
          kind: "unexpected-error",
          detail: `the measurement reply could not be decoded (exit status ${request.status}): ${reply.error}; error output: ${request.stderr}`,
        },
      };
};

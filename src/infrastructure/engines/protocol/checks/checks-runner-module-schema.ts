import { z } from "zod";

import type {
  NamedEngineProjection,
  NamedEngineRun,
} from "../../../../application/ports/engine/engine-run.ts";
import type {
  ChecksSliceProblem,
  MisnamedRuleId,
  ProjectedFile,
} from "../../../../domain/runner/checks-run-report.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { unprojectedFolderSchema } from "../embedded/embedded-run-report-schema.ts";
import { runnerFailureSchema } from "../runner-module/runner-failure-schema.ts";
import { runnerCallSchema } from "../runner-module/runner-module-schema.ts";
import { nativeExceptionKindSchema } from "../runner-module/runner-result-schema.ts";
import type {
  DeepReadonly,
  DeepReadonlyKeepingTuples,
  Equal,
} from "../runner-module/type-equality.ts";
import {
  checkHitSchema,
  checkMeasurementSchema,
  checkNativeExceptionSchema,
} from "./check-wire.ts";

export const namedChecksRunnerModuleSchema = z.object({
  projectedKinds: z.array(nativeExceptionKindSchema),
  fileScope: z.enum(["tracked", "typescript"]),
  run: runnerCallSchema,
  conform: runnerCallSchema,
  project: runnerCallSchema,
});

export type RunnerFileScope = z.output<typeof namedChecksRunnerModuleSchema>["fileScope"];

const misnamedDirectiveShape = {
  ruleId: z.string().min(1),
  file: repoPathSchema,
  line: z.number().int().min(1),
  text: z.string(),
};

export const misnamedRuleIdSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("names-no-check"), ...misnamedDirectiveShape }).readonly(),
  z
    .strictObject({
      kind: z.literal("version-1-id"),
      ...misnamedDirectiveShape,
      replacedBy: z.tuple([z.string().min(1)], z.string().min(1)).readonly(),
    })
    .readonly(),
]);

const engineInstructionsSchema = z
  .strictObject({
    kind: z.literal("engine-instructions"),
    detail: z.string().min(1),
  })
  .readonly();

const projectionInclusionSchema = z.union([
  z.strictObject({ kind: z.literal("include-projection") }).readonly(),
  engineInstructionsSchema,
]);

export const createChecksSliceProblemSchema = <Shape extends z.ZodRawShape>(scope: Shape) =>
  z.discriminatedUnion("state", [
    z
      .strictObject({ ...scope, file: repoPathSchema, state: z.enum(["missing", "out-of-date"]) })
      .readonly(),
    z
      .strictObject({
        ...scope,
        file: repoPathSchema,
        state: z.literal("not-included"),
        recovery: projectionInclusionSchema,
      })
      .readonly(),
    z
      .strictObject({
        ...scope,
        file: repoPathSchema,
        state: z.literal("unconfigured"),
        recovery: z.union([
          z.strictObject({ kind: z.literal("generate-configuration") }).readonly(),
          engineInstructionsSchema,
        ]),
      })
      .readonly(),
  ]);

export const checksSliceProblemSchema = createChecksSliceProblemSchema({});

const checksReportSchema = z.strictObject({
  slices: z
    .array(
      z.union([
        checksSliceProblemSchema,
        z.strictObject({ state: z.literal("left-over"), file: repoPathSchema }).readonly(),
      ]),
    )
    .readonly(),
  nestedConfigurations: z.array(repoPathSchema).readonly(),
  unprojectedFolders: z.array(unprojectedFolderSchema).readonly(),
  misnamedRuleIds: z.array(misnamedRuleIdSchema).readonly(),
  hits: z.array(checkHitSchema).readonly(),
  nativeExceptions: z.array(checkNativeExceptionSchema).readonly(),
  measured: z.array(checkMeasurementSchema).readonly(),
});

const reportWithProjection = <Shape extends z.ZodRawShape>(observations: Shape) => {
  const report = checksReportSchema.extend(observations);
  return z.discriminatedUnion("projection", [
    report.extend({ projection: z.literal("none") }).readonly(),
    report
      .extend({
        projection: z.literal("current"),
        projectionFile: repoPathSchema.optional(),
      })
      .readonly(),
    report
      .extend({
        projection: z.enum(["out-of-date", "missing"]),
        projectionFile: repoPathSchema,
      })
      .readonly(),
    report
      .extend({
        projection: z.literal("not-included"),
        projectionFile: repoPathSchema,
        recovery: projectionInclusionSchema,
      })
      .readonly(),
  ]);
};

export const unscopedChecksRunReportSchema = reportWithProjection({});
export const namedChecksRunReportSchema = reportWithProjection({
  inapplicable: z.array(checkMeasurementSchema).readonly(),
});

type DecodedRunReport = NamedEngineProjection &
  Omit<
    NamedEngineRun,
    "projection" | "mechanism" | "coverableKinds" | "coverage" | "comparedOutputs"
  >;

export const decodeUnscopedChecksReport = (
  wire: z.output<typeof unscopedChecksRunReportSchema>,
): DecodedRunReport => {
  if (wire.projection !== "current") return wire;
  const { projectionFile, ...report } = wire;
  return projectionFile === undefined
    ? report
    : { ...report, projection: "current-with-file", projectionFile };
};

export const namedChecksRunResultSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("ok"), value: namedChecksRunReportSchema }).readonly(),
  z
    .strictObject({
      outcome: z.literal("failed"),
      error: runnerFailureSchema,
    })
    .readonly(),
]);

export const measurementResultSchema = z.discriminatedUnion("outcome", [
  z
    .strictObject({
      outcome: z.literal("ok"),
      value: z
        .strictObject({
          report: namedChecksRunReportSchema,
          unappliedSlices: z.array(repoPathSchema).readonly(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .strictObject({
      outcome: z.literal("failed"),
      error: runnerFailureSchema,
    })
    .readonly(),
]);

const projectedFileSchema = z
  .strictObject({
    kind: z.literal("write"),
    file: repoPathSchema,
    text: z.string(),
  })
  .readonly();

const projectionEntrySchema = z.discriminatedUnion("kind", [
  projectedFileSchema,
  z.strictObject({ kind: z.literal("remove"), file: repoPathSchema }).readonly(),
]);

export const checksProjectResultSchema = z.union([
  z
    .object({ outcome: z.literal("ok"), value: z.array(projectionEntrySchema).readonly() })
    .readonly(),
  z
    .object({
      outcome: z.literal("failed"),
      error: runnerFailureSchema,
    })
    .readonly(),
]);

export const isProjectedFileSchemaEqual: Equal<
  DeepReadonly<z.output<typeof projectedFileSchema>>,
  ProjectedFile
> = true;

export const isChecksSliceProblemSchemaEqual: Equal<
  DeepReadonly<z.output<typeof checksSliceProblemSchema>>,
  ChecksSliceProblem
> = true;

export const isMisnamedRuleIdSchemaEqual: Equal<
  DeepReadonlyKeepingTuples<z.output<typeof misnamedRuleIdSchema>>,
  MisnamedRuleId
> = true;

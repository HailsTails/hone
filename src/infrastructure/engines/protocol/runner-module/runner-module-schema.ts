import { z } from "zod";

import type {
  LoadedRunner,
  LoadedStandaloneRunner,
  RunRequest,
} from "../../../../application/ports/engine/runner-module.ts";
import type { Result } from "../../../../domain/result.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type {
  CaseVerdict,
  NativeException,
} from "../../../../domain/runner/runner-result-types.ts";
import type { nativeExceptionKindSchema } from "./runner-result-schema.ts";
import { nativeExceptionKindSchema as projectedKindSchema } from "./runner-result-schema.ts";
import type { StandaloneRunReport } from "./standalone-run-report-schema.ts";
import type { DeepReadonly, Equal } from "./type-equality.ts";

export type StandaloneRunner = {
  readonly exceptionPath: "standalone";
  readonly run: (request: RunRequest) => Promise<Result<StandaloneRunReport, RunnerFailure>>;
  readonly conform: (request: {
    readonly clause: RunnerClause;
    readonly cases: readonly SourceCase[];
  }) => Promise<Result<readonly CaseVerdict[], RunnerFailure>>;
};

export const runnerCallSchema = z.function({
  input: [z.unknown()],
  output: z.promise(z.unknown()),
});

export const standaloneRunnerModuleSchema = z.object({
  exceptionPath: z.literal("standalone"),
  run: runnerCallSchema,
  conform: runnerCallSchema,
});

export const embeddedRunnerModuleSchema = z.object({
  exceptionPath: z.literal("embedded"),
  projectedKinds: z.array(projectedKindSchema),
  run: runnerCallSchema,
  conform: runnerCallSchema,
  project: runnerCallSchema,
});

export const runnerModuleSchema = z.discriminatedUnion("exceptionPath", [
  standaloneRunnerModuleSchema,
  embeddedRunnerModuleSchema,
]);

export const isLoadedRunnerSchemaEqual: Equal<
  DeepReadonly<z.output<typeof runnerModuleSchema>>,
  LoadedRunner
> = true;

export const isLoadedStandaloneRunnerSchemaEqual: Equal<
  DeepReadonly<z.output<typeof standaloneRunnerModuleSchema>>,
  LoadedStandaloneRunner
> = true;

export const isStandaloneKeySetEqual: Equal<
  keyof StandaloneRunner,
  keyof z.output<typeof standaloneRunnerModuleSchema>
> = true;

export const isStandaloneExceptionPathEqual: Equal<
  StandaloneRunner["exceptionPath"],
  z.output<typeof standaloneRunnerModuleSchema>["exceptionPath"]
> = true;

export const isNativeKindEnumEqual: Equal<
  z.infer<typeof nativeExceptionKindSchema>,
  NativeException["kind"]
> = true;

import { z } from "zod";
import type { SourceCase } from "../../../content-files/rule-sets/rule-set-reader.ts";
import type { AbsolutePath } from "../../../content-files/absolute-path.ts";
import type { RepoPath } from "../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../domain/result.ts";
import type { Equal } from "./type-equality.ts";
import type { RunnerFailure } from "../../../../application/ports/runner-failure.ts";
import type {
  CaseVerdict,
  NativeException,
  nativeExceptionKindSchema,
} from "./runner-result-schema.ts";
import { nativeExceptionKindSchema as projectedKindSchema } from "./runner-result-schema.ts";
import type { RunnerClause } from "../../../../application/ports/runner-module-types.ts";
import type { StandaloneRunReport } from "./standalone-run-report-schema.ts";

export type { RunnerClause } from "../../../../application/ports/runner-module-types.ts";

export type RunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly clauses: readonly RunnerClause[];
};

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

export type LoadedRunner = z.infer<typeof runnerModuleSchema>;

export type LoadedStandaloneRunner = z.infer<typeof standaloneRunnerModuleSchema>;

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

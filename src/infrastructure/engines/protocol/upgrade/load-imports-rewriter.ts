import { z } from "zod";

import type { ModuleExtension } from "../../../../application/ports/host/module-extension.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../application/ports/host/path-port.ts";
import type {
  ImportsRewrittenOf,
  ImportsRewriterOf,
  SpecifierRefusal,
} from "../../../../application/ports/upgrade/version-one-team-layout.ts";
import type { LoadFailure } from "../../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import {
  rejectedCall,
  type RunnerFailure,
  runnerInvalidOutput,
} from "../../../../domain/runner/runner-failure.ts";
import { runnerModuleSegmentsOf } from "../../../node/modules/install-layout.ts";
import { runnerResultSchema } from "../runner-module/runner-result-schema.ts";
import type { DeepReadonly, Equal } from "../runner-module/type-equality.ts";

const specifierRefusalSchema = z
  .object({
    reason: z.enum(["specifier-not-literal", "target-not-moved"]),
    line: z.number().int().positive(),
  })
  .readonly();

const rewrittenSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("ok"), value: z.string() }).readonly(),
  z
    .object({
      outcome: z.literal("failed"),
      error: specifierRefusalSchema,
    })
    .readonly(),
]);

export const isSpecifierRefusalSchemaEqual: Equal<
  DeepReadonly<z.output<typeof specifierRefusalSchema>>,
  SpecifierRefusal
> = true;

const rewriterSchema = runnerResultSchema({
  value: z.function({ input: [z.unknown()], output: rewrittenSchema }),
});

const rewriterModuleSchema = z.object({
  importsRewriterOf: z.function({ input: [], output: z.unknown() }),
});

const loadedRewriterOf = async (options: {
  readonly modules: ModuleLoaderPort;
  readonly path: Pick<PathPort, "join">;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
}): Promise<Result<ImportsRewrittenOf, RunnerFailure>> => {
  const loaded = await options.modules.load({
    path: options.path.join({
      segments: runnerModuleSegmentsOf({ ...options, mechanism: "walker" }),
    }),
  });
  if (loaded.outcome === "failed") return runnerInvalidOutput({ detail: loaded.error.detail });
  const module = rewriterModuleSchema.safeParse(loaded.value);
  if (!module.success) return runnerInvalidOutput({ detail: z.prettifyError(module.error) });
  const rewriter = rewriterSchema.safeParse(await module.data.importsRewriterOf());
  return rewriter.success
    ? rewriter.data
    : runnerInvalidOutput({ detail: z.prettifyError(rewriter.error) });
};

const runnerFailedOf = (failure: RunnerFailure): Result<never, LoadFailure> => ({
  outcome: "failed",
  error: { kind: "runner-failed", mechanism: "walker", failure },
});

export const createImportsRewriterOf =
  (options: Parameters<typeof loadedRewriterOf>[0]): ImportsRewriterOf =>
  () =>
    loadedRewriterOf(options).then(
      (rewriter) => (rewriter.outcome === "failed" ? runnerFailedOf(rewriter.error) : rewriter),
      (thrown: unknown) => {
        const rejected = rejectedCall({ thrown });
        return runnerFailedOf(rejected.error);
      },
    );

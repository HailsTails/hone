import { z } from "zod";

import type { ProjectionRequest } from "../../../../application/ports/engine/runner-module.ts";
import type {
  VersionOneProjectionPlatform,
  VersionOneProjectionPortOf,
} from "../../../../application/ports/upgrade/version-one-projection-port.ts";
import type { Result } from "../../../../domain/result.ts";
import {
  rejectedCall,
  type RunnerFailure,
  runnerInvalidOutput,
} from "../../../../domain/runner/runner-failure.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { runnerModuleSegmentsOf } from "../../../node/modules/install-layout.ts";
import { runnerCallSchema } from "../runner-module/runner-module-schema.ts";
import {
  projectionWriteSchema,
  runnerResultSchema,
} from "../runner-module/runner-result-schema.ts";

const projectionMethodsSchema = z.object({
  inspect: runnerCallSchema,
  prepare: runnerCallSchema,
});

const projectionModuleSchema = z.object({
  versionOneProjectionOver: z.function({
    input: [z.unknown()],
    output: projectionMethodsSchema,
  }),
});

const inspectionResult = z.discriminatedUnion(
  "outcome",
  runnerResultSchema({
    value: z.object({
      files: z
        .array(
          z.object({
            file: repoPathSchema,
            state: z.enum(["current", "missing", "out-of-date"]),
          }),
        )
        .readonly(),
      ruleIds: z.map(z.string(), z.string()),
    }),
  }).options,
);

const preparationResult = runnerResultSchema({ value: z.array(projectionWriteSchema).readonly() });

type Methods = z.output<typeof projectionMethodsSchema>;

const methodsOf = async (
  options: Parameters<VersionOneProjectionPortOf>[0],
): Promise<Result<Methods, RunnerFailure>> => {
  const { modules, installRoot, moduleExtension, path, fileText, fileRemoval } = options;
  const loaded = await modules.load({
    path: path.join({
      segments: runnerModuleSegmentsOf({ installRoot, moduleExtension, mechanism: "eslint" }),
    }),
  });
  if (loaded.outcome === "failed") return runnerInvalidOutput({ detail: loaded.error.detail });
  const parsed = projectionModuleSchema.safeParse(loaded.value);
  if (!parsed.success) return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  const platform: VersionOneProjectionPlatform = { path, fileText, fileRemoval, moduleExtension };
  return { outcome: "ok", value: parsed.data.versionOneProjectionOver(platform) };
};

const projectionCall = async <Value>(request: {
  readonly methods: () => Promise<Result<Methods, RunnerFailure>>;
  readonly method: keyof Methods;
  readonly projection: ProjectionRequest;
  readonly output: z.ZodType<Result<Value, RunnerFailure>>;
}): Promise<Result<Value, RunnerFailure>> => {
  try {
    const loaded = await request.methods();
    if (loaded.outcome === "failed") return loaded;
    const returned = await loaded.value[request.method](request.projection);
    const parsed = request.output.safeParse(returned);
    return parsed.success
      ? parsed.data
      : runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  } catch (thrown) {
    return rejectedCall({ thrown });
  }
};

export const loadVersionOneProjectionOver: VersionOneProjectionPortOf = (options) => {
  let loaded: ReturnType<typeof methodsOf> | undefined;
  const methods = () => (loaded ??= methodsOf(options));
  return {
    inspect: (projection) =>
      projectionCall({ methods, method: "inspect", projection, output: inspectionResult }),
    prepare: (projection) =>
      projectionCall({ methods, method: "prepare", projection, output: preparationResult }),
  };
};

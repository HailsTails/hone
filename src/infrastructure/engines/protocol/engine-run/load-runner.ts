import { z } from "zod";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../domain/repository/absolute-path-types.ts";
import type { MechanismId } from "../../../../domain/rule-set/identifier-types.ts";
import { runnerModuleSegmentsOf } from "../../../node/modules/install-layout.ts";
import type { ModuleExtension } from "../../../../application/ports/host/module-extension.ts";
import type { Result } from "../../../../domain/result.ts";
import { runnerModuleSchema } from "../runner-module/runner-module-schema.ts";
import type { LoadedRunner } from "../../../../application/ports/engine/runner-module.ts";

export type RunnerLocation = {
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly mechanism: MechanismId;
};

export type RunnerInvalid = {
  readonly kind: "runner-invalid";
  readonly mechanism: MechanismId;
  readonly detail: string;
};

const runnerExportSchema = z.object({ runner: runnerModuleSchema });

const runnerInvalid = (request: { readonly mechanism: MechanismId; readonly detail: string }): Result<never, RunnerInvalid> => ({
  outcome: "failed",
  error: { kind: "runner-invalid", ...request },
});

export const loadRunner = async (request: RunnerLocation): Promise<Result<LoadedRunner, RunnerInvalid>> => {
  const loaded = await request.modules.load({
    path: request.path.join({
      segments: runnerModuleSegmentsOf({ installRoot: request.installRoot, mechanism: request.mechanism, moduleExtension: request.moduleExtension }),
    }),
  });
  if (loaded.outcome === "failed") {
    return runnerInvalid({ mechanism: request.mechanism, detail: loaded.error.detail });
  }
  const parsed = runnerExportSchema.safeParse(loaded.value);
  if (!parsed.success) {
    return runnerInvalid({ mechanism: request.mechanism, detail: z.prettifyError(parsed.error) });
  }
  return { outcome: "ok", value: parsed.data.runner };
};

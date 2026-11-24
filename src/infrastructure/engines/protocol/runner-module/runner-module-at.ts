import type { RunnerModuleOf } from "../../../../application/ports/engine/runner-location.ts";
import { runnerModuleSegmentsOf } from "../../../node/modules/install-layout.ts";

export const runnerModuleAt: RunnerModuleOf = (location) =>
  location.modules.load({
    path: location.path.join({
      segments: runnerModuleSegmentsOf({
        installRoot: location.installRoot,
        mechanism: location.mechanism,
        moduleExtension: location.moduleExtension,
      }),
    }),
  });

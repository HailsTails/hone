import type { EnginePort } from "../../../application/ports/engine/engine-port.ts";
import { checkConformance } from "./conformance.ts";
import { projectMechanism, runMechanismWithRecords } from "./embedded/embedded-mechanism-dispatch.ts";
import { engineProjectionOf, engineRunOf, loadedEngineOf } from "./engine-run/engine-run.ts";

export const createDefaultEnginePort = (_options: Record<string, never>): EnginePort => ({
  load: loadedEngineOf,
  run: { checks: engineRunOf, withRecords: runMechanismWithRecords },
  project: { checks: engineProjectionOf, withRecords: projectMechanism },
  conform: checkConformance,
});

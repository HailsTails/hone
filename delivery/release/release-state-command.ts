import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { runReleaseState } from "./release-state.ts";

runReleaseState({ process: createDefaultProcessPort({}) });

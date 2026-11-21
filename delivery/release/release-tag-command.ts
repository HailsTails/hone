import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { runReleaseTag } from "./release-tag.ts";

runReleaseTag({ process: createDefaultProcessPort({}) });

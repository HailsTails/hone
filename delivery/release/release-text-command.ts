import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { TOOL_IDENTITY } from "../../src/domain/rule-set/tool-identity.ts";
import { runReleaseText } from "./release-text.ts";

runReleaseText({ process: createDefaultProcessPort({}), identity: TOOL_IDENTITY });

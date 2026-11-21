import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { runPullRequestTitleCheck } from "./pull-request-title.ts";

runPullRequestTitleCheck({ process: createDefaultProcessPort({}) });

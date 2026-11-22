#!/usr/bin/env node
import { runToolCommand } from "./composition/run-tool-command.ts";
import { createDefaultProcessPort } from "./infrastructure/node/process/process-port.ts";

await runToolCommand({ process: createDefaultProcessPort({}), moduleUrl: import.meta.url });

import { measureEnginesFromArguments } from "./composition/engines-measurement.ts";
import { createDefaultProcessPort } from "./infrastructure/node/process/process-port.ts";

await measureEnginesFromArguments({
  process: createDefaultProcessPort({}),
  moduleUrl: import.meta.url,
});

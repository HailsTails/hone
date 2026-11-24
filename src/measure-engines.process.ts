import { runMeasurementProcess } from "./composition/engines-measurement.ts";
import { createDefaultProcessPort } from "./infrastructure/node/process/process-port.ts";
import { createDefaultReplyPort } from "./infrastructure/node/process/reply-port.ts";

await runMeasurementProcess({
  process: createDefaultProcessPort({}),
  reply: createDefaultReplyPort(),
  moduleUrl: import.meta.url,
});

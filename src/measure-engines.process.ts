import { runMeasurementProcess } from "./composition/engines-measurement.ts";
import { createDefaultProcessPort } from "./infrastructure/node/process/process-port.ts";
import { createDefaultReplyPort } from "./infrastructure/node/process/reply-port.ts";
import { createDefaultRequestPort } from "./infrastructure/node/process/request-port.ts";

await runMeasurementProcess({
  process: createDefaultProcessPort({}),
  request: createDefaultRequestPort(),
  reply: createDefaultReplyPort(),
  moduleUrl: import.meta.url,
});

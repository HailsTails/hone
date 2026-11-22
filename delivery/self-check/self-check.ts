import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { runSelfCheck } from "./self-check-gate.ts";

await runSelfCheck({
  process: createDefaultProcessPort({}),
  moduleUrl: new URL("../../src/hone.ts", import.meta.url).href,
});

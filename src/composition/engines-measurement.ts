import type { NamedEngineRun } from "../application/ports/engine/engine-run.ts";
import { moduleExtensionOf } from "../application/ports/host/module-extension.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { ReplyPort } from "../application/ports/host/reply-port.ts";
import type { RequestPort } from "../application/ports/host/request-port.ts";
import { measureEngines, versionTwoInputsOf } from "../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import type { Result } from "../domain/result.ts";
import {
  type Measuring,
  runEnginesMeasurement,
} from "../infrastructure/engines/protocol/child-measurement/measurement-wire.ts";
import { INSTALLED_PORTS } from "./run-tool-command.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

const measureInProcess = async (request: {
  readonly moduleUrl: string;
  readonly measuring: Measuring;
}): Promise<Result<readonly NamedEngineRun[], RunLoadFailure>> => {
  const { tree, ...locations } = request.measuring;
  const stages = versionTwoStagesOver({
    ports: INSTALLED_PORTS,
    locations: {
      ...locations,
      moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
    },
  });
  const inputs = versionTwoInputsOf({ stages });
  if (inputs.outcome === "failed") return inputs;
  const measured = await measureEngines({
    inputs: inputs.value,
    stages: { engines: stages.engines, tree: () => ({ outcome: "ok", value: tree }) },
  });
  return measured.outcome === "failed" ? measured : { outcome: "ok", value: measured.value.runs };
};

export const runMeasurementProcess = (request: {
  readonly process: Pick<ProcessPort, "arguments">;
  readonly request: RequestPort;
  readonly reply: ReplyPort;
  readonly moduleUrl: string;
}): Promise<void> =>
  runEnginesMeasurement({
    process: request.process,
    request: request.request,
    reply: request.reply,
    measure: (measuring) => measureInProcess({ moduleUrl: request.moduleUrl, measuring }),
  });

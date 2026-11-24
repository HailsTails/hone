import type { NamedEngineRun } from "../application/ports/engine/engine-run.ts";
import { moduleExtensionOf } from "../application/ports/host/module-extension.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import { measureEngines } from "../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import type { Result } from "../domain/result.ts";
import {
  type MeasurementArguments,
  runEnginesMeasurement,
} from "../infrastructure/engines/protocol/child-measurement/measurement-wire.ts";
import { INSTALLED_PORTS } from "./run-tool-command.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

const measureInProcess = async (request: {
  readonly moduleUrl: string;
  readonly measuring: MeasurementArguments;
}): Promise<Result<readonly NamedEngineRun[], RunLoadFailure>> => {
  const measured = await measureEngines({
    stages: versionTwoStagesOver({
      ports: INSTALLED_PORTS,
      locations: {
        ...request.measuring,
        moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
      },
    }),
  });
  return measured.outcome === "failed" ? measured : { outcome: "ok", value: measured.value.runs };
};

export const measureEnginesFromArguments = (request: {
  readonly process: ProcessPort;
  readonly moduleUrl: string;
}): Promise<void> =>
  runEnginesMeasurement({
    process: request.process,
    measure: (measuring) => measureInProcess({ moduleUrl: request.moduleUrl, measuring }),
  });

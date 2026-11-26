import type { RunnerModuleOf } from "../application/ports/engine/runner-location.ts";
import {
  loadedNamedRunnerOver,
  measureVersionOneProjectionOver,
  namedEngineOutputPathsOf,
  namedEngineProjectionOf,
  namedEngineRunOf,
} from "../infrastructure/engines/protocol/engine-run/engine-run.ts";
import { versionOneProjectionPortOver } from "../infrastructure/engines/protocol/upgrade/load-version-one-projection.ts";
import type { ToolPorts } from "./tool-ports.ts";

export type RunnerEngines = Pick<
  ToolPorts,
  "namedEngine" | "versionOneProjectionOf" | "measureVersionOne"
>;

export const runnerEnginesOver = (ports: {
  readonly runnerModuleOf: RunnerModuleOf;
}): RunnerEngines => ({
  namedEngine: {
    load: loadedNamedRunnerOver(ports),
    run: namedEngineRunOf,
    project: namedEngineProjectionOf,
    outputPaths: namedEngineOutputPathsOf,
  },
  versionOneProjectionOf: versionOneProjectionPortOver(ports),
  measureVersionOne: measureVersionOneProjectionOver(ports),
});

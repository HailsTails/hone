import type {
  NamedConformancePort,
  NamedEnginePort,
} from "../../../application/ports/engine/engine-port.ts";
import { namedCheckConformance } from "./conformance.ts";
import {
  loadedNamedRunnerOf,
  namedEngineProjectionOf,
  namedEngineRunOf,
} from "./engine-run/engine-run.ts";

export const createNamedConformancePort = (
  _options: Record<string, never>,
): NamedConformancePort => ({
  load: loadedNamedRunnerOf,
  conform: namedCheckConformance,
});

export const createNamedEnginePort = (_options: Record<string, never>): NamedEnginePort => ({
  load: loadedNamedRunnerOf,
  run: namedEngineRunOf,
  project: namedEngineProjectionOf,
});

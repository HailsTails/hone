import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { CleanUpPhase, SpeedSidesPreparation } from "./prepare-speed-sides.ts";
import type { PairsResult } from "./run-speed-pairs.ts";
import type {
  SpeedBaselineArgumentsPort,
  SpeedBaselineMode,
} from "./speed-baseline-arguments-port.ts";
import type { SpeedBaselineConfiguration } from "./speed-baseline-configuration.ts";
import {
  mapPairsRunToSpeedBaselineOutcome,
  type SpeedBaselineOutcome,
} from "./speed-baseline-outcome.ts";
import type { SpeedSide } from "./speed-samples.ts";
import { createSpeedVerdict } from "./speed-verdict.ts";
import type { SideInstall } from "./write-side-install.ts";

export type SpeedBaselinePhases = {
  readonly prepare: (request: {
    readonly repo: AbsolutePath;
    readonly mode: SpeedBaselineMode;
    readonly revision: string;
  }) => SpeedSidesPreparation;
  readonly measure: (request: {
    readonly repo: AbsolutePath;
    readonly installs: Readonly<Record<SpeedSide, SideInstall>>;
    readonly tree: string;
    readonly baseRevision: string;
    readonly pairCount: number;
  }) => PairsResult;
  readonly cleanUp: CleanUpPhase;
};

export const runSpeedBaseline = (request: {
  readonly ports: { readonly arguments: SpeedBaselineArgumentsPort };
  readonly phases: SpeedBaselinePhases;
  readonly configuration: SpeedBaselineConfiguration;
}): SpeedBaselineOutcome => {
  const read = request.ports.arguments.read();
  if (read.outcome === "failed") return { kind: "usage-refused", refusal: read.error };
  const { repo, mode } = read.value;
  const { phases, configuration } = request;
  const preparation = phases.prepare({ repo, mode, revision: configuration.baselineRevision });
  if (preparation.prepared.outcome === "failed") {
    return {
      kind: "unprepared",
      refusal: preparation.prepared.error,
      leftovers: preparation.leftovers,
    };
  }
  const { installs, tree, made } = preparation.prepared.value;
  const pairs = phases.measure({
    repo,
    installs,
    tree,
    baseRevision: configuration.targetBaseRevision,
    pairCount: configuration.pairCount,
  });
  const removed = phases.cleanUp({ repo, ...made });
  return mapPairsRunToSpeedBaselineOutcome({
    mode,
    repo,
    run: pairs.run,
    allowancePercents: configuration.allowancePercents,
    setUpMilliseconds: pairs.setUpMilliseconds,
    leftovers: [...preparation.leftovers, ...pairs.leftovers, ...removed],
    createVerdict: createSpeedVerdict,
  });
};

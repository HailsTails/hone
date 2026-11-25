import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { HoneCheckFailure } from "./hone-check-port.ts";
import type { PreparedSample } from "./prepare-sample.ts";
import type { Leftover, PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SampleTimes, SpeedSide } from "./speed-samples.ts";
import type { SideInstall } from "./write-side-install.ts";

export type SampleRun =
  | {
      readonly kind: "measured";
      readonly times: SampleTimes;
      readonly setUpMilliseconds: number;
      readonly leftovers: readonly Leftover[];
    }
  | {
      readonly kind: "check-failed";
      readonly failure: HoneCheckFailure;
      readonly leftovers: readonly Leftover[];
    }
  | {
      readonly kind: "unprepared";
      readonly refusal: PreparationRefusal;
      readonly leftovers: readonly Leftover[];
    };

export type SampleStages = {
  readonly prepareSample: (request: {
    readonly repo: AbsolutePath;
    readonly side: SpeedSide;
    readonly sampleIndex: number;
    readonly install: SideInstall;
    readonly tree: string;
  }) => PreparedSample;
  readonly timeSample: (request: {
    readonly temporaryFolder: AbsolutePath;
    readonly command: AbsolutePath;
    readonly copy: AbsolutePath;
    readonly baseRevision: string;
  }) => Result<SampleTimes, HoneCheckFailure>;
  readonly removeSample: (request: {
    readonly repo: AbsolutePath;
    readonly copy: AbsolutePath;
  }) => readonly Leftover[];
};

export const runSpeedSample = (request: {
  readonly stages: SampleStages;
  readonly repo: AbsolutePath;
  readonly side: SpeedSide;
  readonly sampleIndex: number;
  readonly install: SideInstall;
  readonly tree: string;
  readonly baseRevision: string;
}): SampleRun => {
  const { stages, repo } = request;
  const prepared = stages.prepareSample({
    repo,
    side: request.side,
    sampleIndex: request.sampleIndex,
    install: request.install,
    tree: request.tree,
  });
  if (prepared.kind === "unplaced") {
    return { kind: "unprepared", refusal: prepared.refusal, leftovers: [] };
  }
  if (prepared.kind === "unprepared") {
    const leftovers = stages.removeSample({ repo, copy: prepared.copy });
    return { kind: "unprepared", refusal: prepared.refusal, leftovers };
  }
  const times = stages.timeSample({
    temporaryFolder: prepared.temporaryFolder,
    command: request.install.command,
    copy: prepared.copy,
    baseRevision: request.baseRevision,
  });
  const leftovers = stages.removeSample({ repo, copy: prepared.copy });
  return times.outcome === "failed"
    ? { kind: "check-failed", failure: times.error, leftovers }
    : {
        kind: "measured",
        times: times.value,
        setUpMilliseconds: prepared.setUpMilliseconds,
        leftovers,
      };
};

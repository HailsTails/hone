import type { Result } from "../../src/domain/result.ts";
import type { SampleRun } from "./run-speed-sample.ts";
import type { Leftover, PairsRun } from "./speed-baseline-outcome.ts";
import type { PairTimes, PairTimesList, SpeedSide } from "./speed-samples.ts";
import { createPairOrder } from "./speed-schedule.ts";
import type { SideInstall } from "./write-side-install.ts";

export type PairsResult = {
  readonly run: PairsRun;
  readonly setUpMilliseconds: readonly number[];
  readonly leftovers: readonly Leftover[];
};

export type RunSampleStage = (request: {
  readonly side: SpeedSide;
  readonly sampleIndex: number;
  readonly install: SideInstall;
}) => SampleRun;

type PairsRequest = {
  readonly runSample: RunSampleStage;
  readonly installs: Readonly<Record<SpeedSide, SideInstall>>;
  readonly pairCount: number;
};

type PairResult = {
  readonly pair: Result<PairTimes, Exclude<PairsRun, { readonly kind: "measured" }>>;
  readonly setUpMilliseconds: readonly number[];
  readonly leftovers: readonly Leftover[];
};

const runSide = (
  request: PairsRequest & { readonly side: SpeedSide; readonly pairIndex: number },
): SampleRun =>
  request.runSample({
    side: request.side,
    sampleIndex: request.pairIndex,
    install: request.installs[request.side],
  });

const mapSampleRunsToPair = (request: {
  readonly runs: Readonly<Record<SpeedSide, SampleRun>>;
}): PairResult["pair"] => {
  const { baseline, head } = request.runs;
  if (baseline.kind === "unprepared") return { outcome: "failed", error: baseline };
  if (head.kind === "unprepared") return { outcome: "failed", error: head };
  return baseline.kind === "measured" && head.kind === "measured"
    ? { outcome: "ok", value: { baseline: baseline.times, head: head.times } }
    : {
        outcome: "failed",
        error: {
          kind: "check-failed",
          runs: {
            baseline:
              baseline.kind === "measured"
                ? { outcome: "ok", value: baseline.times }
                : { outcome: "failed", error: baseline.failure },
            head:
              head.kind === "measured"
                ? { outcome: "ok", value: head.times }
                : { outcome: "failed", error: head.failure },
          },
        },
      };
};

const mapSampleRunToSetUp = (request: { readonly run: SampleRun }): readonly number[] =>
  request.run.kind === "measured" ? [request.run.setUpMilliseconds] : [];

const runPair = (request: PairsRequest & { readonly pairIndex: number }): PairResult => {
  const [firstSide, secondSide] = createPairOrder(request);
  const first = runSide({ ...request, side: firstSide });
  if (first.kind === "unprepared") {
    return {
      pair: { outcome: "failed", error: first },
      setUpMilliseconds: [],
      leftovers: first.leftovers,
    };
  }
  const second = runSide({ ...request, side: secondSide });
  return {
    pair: mapSampleRunsToPair({
      runs:
        firstSide === "baseline"
          ? { baseline: first, head: second }
          : { baseline: second, head: first },
    }),
    setUpMilliseconds: [
      ...mapSampleRunToSetUp({ run: first }),
      ...mapSampleRunToSetUp({ run: second }),
    ],
    leftovers: [...first.leftovers, ...second.leftovers],
  };
};

const runRemainingPairs = (
  request: PairsRequest & {
    readonly pairIndex: number;
    readonly pairs: readonly PairTimes[];
    readonly setUpMilliseconds: readonly number[];
    readonly leftovers: readonly Leftover[];
  },
): PairsResult => {
  const ran = runPair(request);
  const setUpMilliseconds = [...request.setUpMilliseconds, ...ran.setUpMilliseconds];
  const leftovers = [...request.leftovers, ...ran.leftovers];
  if (ran.pair.outcome === "failed") return { run: ran.pair.error, setUpMilliseconds, leftovers };
  const pairs: PairTimesList = [...request.pairs, ran.pair.value];
  return request.pairIndex + 1 >= request.pairCount
    ? { run: { kind: "measured", pairs }, setUpMilliseconds, leftovers }
    : runRemainingPairs({
        ...request,
        pairIndex: request.pairIndex + 1,
        pairs,
        setUpMilliseconds,
        leftovers,
      });
};

export const runSpeedPairs = (request: PairsRequest): PairsResult =>
  runRemainingPairs({ ...request, pairIndex: 0, pairs: [], setUpMilliseconds: [], leftovers: [] });

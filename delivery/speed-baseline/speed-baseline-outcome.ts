import type { PackageManifestUnresolved } from "../../src/application/ports/host/package-manifest-port.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { BaselineCheckoutFailure, BaselineRemovalFailure } from "./baseline-checkout-port.ts";
import type { DirectoryRemovalFailure } from "./directory-removal-port.ts";
import type { HoneCheckFailure } from "./hone-check-port.ts";
import type { HoneDependenciesFailure } from "./hone-dependencies-port.ts";
import type { HoneInstallFailure } from "./hone-install-check.ts";
import type { HonePackageFailure } from "./hone-package-port.ts";
import type { IndexRemovalFailure } from "./index-removal-port.ts";
import type { InstalledCommandFailure } from "./installed-command-port.ts";
import type { LockfilesFailure } from "./lockfiles-port.ts";
import type {
  SpeedBaselineMode,
  SpeedBaselineUsageRefusal,
} from "./speed-baseline-arguments-port.ts";
import type { PairTimesList, SampleTimes, SpeedMeasure, SpeedSide } from "./speed-samples.ts";
import { createSpeedSpreads, type MeasureSpread } from "./speed-spread.ts";
import { mapValuesToMedian } from "./speed-statistics.ts";
import type { SpeedVerdict } from "./speed-verdict.ts";
import type { TargetCopyFailure, TargetCopyRemovalFailure } from "./target-copy-port.ts";
import type { TargetIndexFailure } from "./target-index-port.ts";
import type { TargetInstallFailure } from "./target-install-port.ts";
import type { TargetPackageManagerFailure } from "./target-package-manager.ts";
import type { TargetTreeFailure, TargetTreeWriteFailure } from "./target-tree-port.ts";
import type { TemporaryFolderFailure } from "./temporary-folder-port.ts";

export type Leftover =
  | BaselineRemovalFailure
  | TargetCopyRemovalFailure
  | DirectoryRemovalFailure
  | IndexRemovalFailure;

export type PreparationFailure =
  | TargetIndexFailure
  | PackageManifestUnresolved
  | HoneInstallFailure
  | BaselineCheckoutFailure
  | TargetCopyFailure
  | TargetTreeFailure
  | TargetTreeWriteFailure
  | HoneDependenciesFailure
  | HonePackageFailure
  | LockfilesFailure
  | TargetPackageManagerFailure
  | TargetInstallFailure
  | InstalledCommandFailure
  | TemporaryFolderFailure;

export type PreparationRefusal = {
  readonly side: SpeedSide | "target";
  readonly failure: PreparationFailure;
};

export type SideRun = Result<SampleTimes, HoneCheckFailure>;

export type PairsRun =
  | { readonly kind: "measured"; readonly pairs: PairTimesList }
  | { readonly kind: "check-failed"; readonly runs: Readonly<Record<SpeedSide, SideRun>> }
  | { readonly kind: "unprepared"; readonly refusal: PreparationRefusal };

export type SetUpSummary = {
  readonly medianMilliseconds: number;
  readonly sampleCount: number;
};

export type SpeedBaselineOutcome =
  | { readonly kind: "usage-refused"; readonly refusal: SpeedBaselineUsageRefusal }
  | {
      readonly kind: "unprepared";
      readonly refusal: PreparationRefusal;
      readonly leftovers: readonly Leftover[];
    }
  | {
      readonly kind: "check-failed";
      readonly repo: AbsolutePath;
      readonly runs: Readonly<Record<SpeedSide, SideRun>>;
      readonly leftovers: readonly Leftover[];
    }
  | {
      readonly kind: "compared";
      readonly verdict: SpeedVerdict;
      readonly setUp: SetUpSummary;
      readonly leftovers: readonly Leftover[];
    }
  | {
      readonly kind: "calibrated";
      readonly spreads: readonly MeasureSpread[];
      readonly setUp: SetUpSummary;
      readonly leftovers: readonly Leftover[];
    };

type MeasuredOutcome = Exclude<SpeedBaselineOutcome, { readonly kind: "usage-refused" }>;

export const mapPairsRunToSpeedBaselineOutcome = (request: {
  readonly run: PairsRun;
  readonly mode: SpeedBaselineMode;
  readonly repo: AbsolutePath;
  readonly allowancePercents: Readonly<Record<SpeedMeasure, number>>;
  readonly setUpMilliseconds: readonly number[];
  readonly leftovers: readonly Leftover[];
  readonly createVerdict: (request: {
    readonly pairs: PairTimesList;
    readonly allowancePercents: Readonly<Record<SpeedMeasure, number>>;
  }) => SpeedVerdict;
}): MeasuredOutcome => {
  const { run, leftovers } = request;
  const setUp: SetUpSummary = {
    medianMilliseconds: mapValuesToMedian({ values: request.setUpMilliseconds }),
    sampleCount: request.setUpMilliseconds.length,
  };
  switch (run.kind) {
    case "unprepared":
      return { kind: "unprepared", refusal: run.refusal, leftovers };
    case "check-failed":
      return { kind: "check-failed", repo: request.repo, runs: run.runs, leftovers };
    case "measured":
      return request.mode === "calibrate"
        ? {
            kind: "calibrated",
            spreads: createSpeedSpreads({ pairs: run.pairs }),
            setUp,
            leftovers,
          }
        : {
            kind: "compared",
            verdict: request.createVerdict({
              pairs: run.pairs,
              allowancePercents: request.allowancePercents,
            }),
            setUp,
            leftovers,
          };
  }
};

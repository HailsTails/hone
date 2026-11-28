import type { PackageManifestUnresolved } from "../../src/application/ports/host/package-manifest-port.ts";
import type { ExitCode } from "../../src/application/ports/host/process-port.ts";
import type { BaselineCheckoutFailure, BaselineRemovalFailure } from "./baseline-checkout-port.ts";
import type { CommandFailure } from "./command-failure.ts";
import type { DirectoryRemovalFailure } from "./directory-removal-port.ts";
import type { HoneCheckFailure } from "./hone-check-port.ts";
import type { HoneDependenciesFailure } from "./hone-dependencies-port.ts";
import type { HoneInstallFailure } from "./hone-install-check.ts";
import type { HonePackageFailure } from "./hone-package-port.ts";
import type { InstalledCommandFailure } from "./installed-command-port.ts";
import type { LockfilesFailure } from "./lockfiles-port.ts";
import type {
  Leftover,
  PreparationFailure,
  PreparationRefusal,
  SetUpSummary,
  SideRun,
  SpeedBaselineOutcome,
} from "./speed-baseline-outcome.ts";
import type { SpeedSide } from "./speed-samples.ts";
import { mapSpeedSpreadsToText, mapSpeedVerdictToText } from "./speed-verdict-text.ts";
import type { TargetCopyFailure, TargetCopyRemovalFailure } from "./target-copy-port.ts";
import type { TargetInstallFailure } from "./target-install-port.ts";
import { SUPPORTED_LOCKFILES, type TargetPackageManagerFailure } from "./target-package-manager.ts";
import type { TargetTreeFailure, TargetTreeWriteFailure } from "./target-tree-port.ts";
import type { TemporaryFolderFailure } from "./temporary-folder-port.ts";

export type SpeedBaselineReport = {
  readonly out: string;
  readonly error: string;
  readonly exitCode: ExitCode;
};

const EXIT_CODES = { pass: 0, fail: 1, usage: 2, unprepared: 3, unmeasured: 3 } satisfies Readonly<
  Record<string, ExitCode>
>;

const MILLISECONDS_PER_SECOND = 1000;

const SECONDS_DECIMALS = 1;

const SUPPORTED_LOCKFILE_TEXT = SUPPORTED_LOCKFILES.join(" or ");

const mapCommandFailureToText = (request: { readonly command: CommandFailure }): string =>
  request.command.kind === "exited"
    ? `exited ${request.command.status}: ${request.command.output.trimEnd()}`
    : `could not start: ${request.command.detail}`;

const mapCheckoutFailureToText = (request: {
  readonly failure: BaselineCheckoutFailure | BaselineRemovalFailure;
}): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "baseline-unchecked-out":
      return `the baseline revision could not be checked out: ${mapCommandFailureToText(failure)}`;
    case "baseline-unresolved":
      return `the baseline checkout's folder ${failure.path} cannot be resolved`;
    case "baseline-unremoved":
      return `the baseline checkout ${failure.directory} could not be removed: ${mapCommandFailureToText(failure)}`;
  }
};

const mapCopyFailureToText = (request: {
  readonly failure: TargetCopyFailure | TargetCopyRemovalFailure;
}): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "target-uncopied":
      return `the target could not be copied: ${mapCommandFailureToText(failure)}`;
    case "target-copy-unresolved":
      return `the target copy's folder ${failure.path} cannot be resolved`;
    case "target-copy-unremoved":
      return `the target copy ${failure.directory} could not be removed: ${mapCommandFailureToText(failure)}`;
  }
};

const mapTreeFailureToText = (request: {
  readonly failure: TargetTreeFailure | TargetTreeWriteFailure;
}): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "target-tree-unread":
      return `the target's working state could not be written as a tree: ${mapCommandFailureToText(failure)}`;
    case "target-tree-unwritten":
      return `the target's working state could not be written into its copy: ${mapCommandFailureToText(failure)}`;
  }
};

const mapTarballFailureToText = (request: {
  readonly failure: HoneDependenciesFailure | HonePackageFailure;
}): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "hone-dependencies-uninstalled":
      return `Hone's dependencies could not be installed: ${mapCommandFailureToText(failure)}`;
    case "hone-unpacked":
      return `Hone could not be packed: ${mapCommandFailureToText(failure)}`;
    case "tarball-unnamed":
      return `pack-package named no tarball: ${failure.output.trimEnd()}`;
    case "tarball-unresolved":
      return `the packed tarball ${failure.path} cannot be resolved`;
  }
};

const mapInstallFailureToText = (request: {
  readonly failure:
    | LockfilesFailure
    | TargetPackageManagerFailure
    | TargetInstallFailure
    | InstalledCommandFailure;
}): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "lockfiles-unread":
      return `the target copy's files could not be listed: ${failure.detail}`;
    case "lockfile-unsupported":
      return `the target locks with ${failure.lockfile}; Hone installs with ${SUPPORTED_LOCKFILE_TEXT}`;
    case "lockfile-missing":
      return `the target has no lockfile; Hone installs with ${SUPPORTED_LOCKFILE_TEXT}`;
    case "hone-uninstalled":
      return `Hone could not be installed into the target's copy: ${mapCommandFailureToText(failure)}`;
    case "installed-manifest-unread":
      return `the installed Hone's manifest could not be read: ${failure.detail}`;
    case "installed-command-unnamed":
      return `${failure.manifest} names no hone command`;
    case "installed-command-unresolved":
      return `the installed hone command ${failure.path} cannot be resolved`;
  }
};

const mapSampleFailureToText = (request: {
  readonly failure:
    | PackageManifestUnresolved
    | HoneInstallFailure
    | Exclude<TemporaryFolderFailure, { readonly kind: "target-index-directory-uncreatable" }>
    | DirectoryRemovalFailure;
}): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "package-manifest-unresolved":
      return `Hone could not be resolved from the sample: ${failure.detail}`;
    case "hone-outside-install":
      return `Hone resolved to ${failure.resolved} from the sample, but to ${failure.installResolved} from the side's install ${failure.install}`;
    case "temporary-folder-unwritten":
      return `the sample's temporary folder could not be made: ${failure.detail}`;
    case "temporary-folder-unresolved":
      return `the sample's temporary folder ${failure.path} cannot be resolved`;
    case "directory-unremoved":
      return `${failure.directory} could not be removed: ${failure.detail}`;
  }
};

const mapPreparationFailureToText = (request: {
  readonly failure: PreparationFailure | Leftover;
}): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "baseline-unchecked-out":
    case "baseline-unresolved":
    case "baseline-unremoved":
      return mapCheckoutFailureToText({ failure });
    case "target-uncopied":
    case "target-copy-unresolved":
    case "target-copy-unremoved":
      return mapCopyFailureToText({ failure });
    case "target-index-directory-uncreatable":
      return `the target's temporary index directory could not be created: ${failure.detail}`;
    case "target-tree-unread":
    case "target-tree-unwritten":
      return mapTreeFailureToText({ failure });
    case "hone-dependencies-uninstalled":
    case "hone-unpacked":
    case "tarball-unnamed":
    case "tarball-unresolved":
      return mapTarballFailureToText({ failure });
    case "lockfiles-unread":
    case "lockfile-unsupported":
    case "lockfile-missing":
    case "hone-uninstalled":
    case "installed-manifest-unread":
    case "installed-command-unnamed":
    case "installed-command-unresolved":
      return mapInstallFailureToText({ failure });
    case "package-manifest-unresolved":
    case "hone-outside-install":
    case "temporary-folder-unwritten":
    case "temporary-folder-unresolved":
    case "directory-unremoved":
      return mapSampleFailureToText({ failure });
  }
};
const mapRefusalToText = (request: { readonly refusal: PreparationRefusal }): string =>
  `speed-baseline: the ${request.refusal.side} was not set up: ${mapPreparationFailureToText({ failure: request.refusal.failure })}\n`;

const mapLeftoversToText = (request: { readonly leftovers: readonly Leftover[] }): string =>
  request.leftovers
    .map((failure) => `speed-baseline: ${mapPreparationFailureToText({ failure })}\n`)
    .join("");

const mapCheckFailureToText = (request: { readonly failure: HoneCheckFailure }): string => {
  switch (request.failure.kind) {
    case "check-exited":
      return `exited ${request.failure.status}: ${request.failure.output}`;
    case "check-unlaunched":
      return `could not start: ${request.failure.detail}`;
    case "cpu-time-missing":
      return "printed no CPU time";
  }
};

const mapFailuresToLikeness = (request: {
  readonly baseline: HoneCheckFailure;
  readonly head: HoneCheckFailure;
}): "alike" | "different" => {
  const alike =
    request.baseline.kind === "check-exited" && request.head.kind === "check-exited"
      ? request.baseline.status === request.head.status
      : request.baseline.kind === request.head.kind;
  return alike ? "alike" : "different";
};

const mapSideRunToText = (request: {
  readonly side: SpeedSide;
  readonly run: SideRun;
  readonly repo: string;
}): string =>
  request.run.outcome === "failed"
    ? `speed-baseline: the ${request.side} could not check ${request.repo}: ${mapCheckFailureToText({ failure: request.run.error })}\n`
    : "";

const mapRunsToText = (request: {
  readonly runs: Readonly<Record<SpeedSide, SideRun>>;
  readonly repo: string;
}): string => {
  const { baseline, head } = request.runs;
  if (
    baseline.outcome === "failed" &&
    head.outcome === "failed" &&
    mapFailuresToLikeness({ baseline: baseline.error, head: head.error }) === "alike"
  ) {
    return `speed-baseline: both sides failed to check ${request.repo}: ${mapCheckFailureToText({ failure: baseline.error })}\n`;
  }
  const lines = `${mapSideRunToText({ side: "head", run: head, repo: request.repo })}${mapSideRunToText({ side: "baseline", run: baseline, repo: request.repo })}`;
  return baseline.outcome === "failed" && head.outcome === "ok"
    ? `${lines}re-pin the baseline\n`
    : lines;
};

const mapSetUpToText = (request: { readonly setUp: SetUpSummary }): string =>
  `speed-baseline: set-up per sample: median ${(request.setUp.medianMilliseconds / MILLISECONDS_PER_SECOND).toFixed(SECONDS_DECIMALS)} s over ${request.setUp.sampleCount} samples\n`;

export const mapSpeedBaselineOutcomeToReport = (request: {
  readonly outcome: SpeedBaselineOutcome;
}): SpeedBaselineReport => {
  const { outcome } = request;
  switch (outcome.kind) {
    case "usage-refused":
      return {
        out: "",
        error: `${outcome.refusal.detail}\n${outcome.refusal.usage}`,
        exitCode: EXIT_CODES.usage,
      };
    case "unprepared":
      return {
        out: "",
        error: `${mapRefusalToText(outcome)}${mapLeftoversToText(outcome)}`,
        exitCode: EXIT_CODES.unprepared,
      };
    case "check-failed":
      return {
        out: "",
        error: `${mapRunsToText(outcome)}${mapLeftoversToText(outcome)}`,
        exitCode: outcome.runs.baseline.outcome === "ok" ? EXIT_CODES.fail : EXIT_CODES.unmeasured,
      };
    case "compared":
      return {
        out: `${mapSpeedVerdictToText({ verdict: outcome.verdict })}${mapSetUpToText(outcome)}`,
        error: mapLeftoversToText(outcome),
        exitCode: EXIT_CODES[outcome.verdict.outcome],
      };
    case "calibrated":
      return {
        out: `${mapSpeedSpreadsToText({ spreads: outcome.spreads })}${mapSetUpToText(outcome)}`,
        error: mapLeftoversToText(outcome),
        exitCode: EXIT_CODES.pass,
      };
  }
};

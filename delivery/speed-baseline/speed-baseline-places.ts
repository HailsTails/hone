import type { SpeedSide } from "./speed-samples.ts";
import type { TargetCopyPlace } from "./target-copy-port.ts";

const WORKTREES_FOLDER: readonly string[] = [".claude", "worktrees"];

const BASELINE_CHECKOUT_PREFIX = "baseline-";

const TARGET_COPY_PREFIX = "hone-speed-";

const SAMPLES_FOLDER = "samples";

export const TARGET_INDEX_NAME = "hone-speed-baseline-index";

const mapSideToInstallName = (request: { readonly side: SpeedSide }): string =>
  `${TARGET_COPY_PREFIX}${request.side}`;

export const mapCommitToCheckoutSegments = (request: {
  readonly commit: string;
}): readonly string[] => [...WORKTREES_FOLDER, `${BASELINE_CHECKOUT_PREFIX}${request.commit}`];

export const mapPlaceToSegments = (request: {
  readonly place: TargetCopyPlace;
}): readonly string[] => {
  const install = [...WORKTREES_FOLDER, mapSideToInstallName(request.place)];
  return request.place.kind === "install"
    ? install
    : [...install, SAMPLES_FOLDER, String(request.place.sampleIndex)];
};

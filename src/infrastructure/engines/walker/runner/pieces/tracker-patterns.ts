import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import { stringListCheckSettings } from "./piece-check-settings.ts";

const NUMBERED_REFERENCE = /\([^()\s]*\d[^()\s]*\)/;
const TRACKED_REFERENCE_PATTERN = new RegExp(NUMBERED_REFERENCE.source, "g");
const LEADING_TRACKED_REFERENCE_PATTERN = new RegExp(`^\\s*(${NUMBERED_REFERENCE.source})`);
const WHOLE_NUMBERED_REFERENCE_PATTERN = new RegExp(`^${NUMBERED_REFERENCE.source}$`);

export const numberedReferenceKind = (text: string): "numbered" | "other" =>
  WHOLE_NUMBERED_REFERENCE_PATTERN.test(text) ? "numbered" : "other";

export type TrackedCheck = {
  readonly binding: CheckBinding;
  readonly trackers: readonly RegExp[];
};

export type Tracking = "tracked" | "untracked";

const compiledTracker = (request: {
  readonly binding: CheckBinding;
  readonly source: string;
}): Result<readonly RegExp[], PieceFailure> => {
  try {
    return { outcome: "ok", value: [new RegExp(request.source)] };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: request.binding.pieceRoot,
        detail: `the checkSettings of ${request.binding.address} are malformed: trackerPatterns entry ${JSON.stringify(request.source)} is not a regular expression: ${thrown instanceof Error ? thrown.message : String(thrown)}`,
      },
    };
  }
};

const trackedCheckOf = (request: {
  readonly binding: CheckBinding;
}): Result<readonly TrackedCheck[], PieceFailure> => {
  const settings = stringListCheckSettings({
    binding: request.binding,
    keys: ["trackerPatterns"],
  });
  if (settings.outcome === "failed") return settings;
  const trackers = gatheredOutcomes({
    outcomes: settings.value.trackerPatterns.map((source) =>
      compiledTracker({ binding: request.binding, source }),
    ),
  });
  if (trackers.outcome === "failed") return trackers;
  return {
    outcome: "ok",
    value: [{ binding: request.binding, trackers: trackers.value }],
  };
};

export const trackedChecksOf = (request: {
  readonly bindings: readonly CheckBinding[];
}): Result<readonly TrackedCheck[], PieceFailure> =>
  gatheredOutcomes({
    outcomes: request.bindings.map((binding) => trackedCheckOf({ binding })),
  });

export const trackingReference = (request: {
  readonly reference: string;
  readonly tracked: TrackedCheck;
}): Tracking =>
  request.tracked.trackers.some((tracker) => tracker.test(request.reference))
    ? "tracked"
    : "untracked";

export const trackingAnywhere = (request: {
  readonly text: string;
  readonly tracked: TrackedCheck;
}): Tracking =>
  Array.from(request.text.matchAll(TRACKED_REFERENCE_PATTERN), (match) => match[0]).some(
    (reference) => trackingReference({ ...request, reference }) === "tracked",
  )
    ? "tracked"
    : "untracked";

export const trackingAtStart = (request: {
  readonly text: string;
  readonly tracked: TrackedCheck;
}): Tracking => {
  const reference = LEADING_TRACKED_REFERENCE_PATTERN.exec(request.text)?.[1];
  return reference === undefined ? "untracked" : trackingReference({ ...request, reference });
};

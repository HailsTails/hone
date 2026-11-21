import type { Result } from "../../../src/domain/result.ts";

export type CaretRange = { readonly floor: string; readonly major: number; readonly minor: number; readonly patch: number };

export type CaretFit = "within" | "outside";

type Release = { readonly major: number; readonly minor: number; readonly patch: number };

type CaretSpan = "same-major" | "same-minor" | "same-patch";

const CARET_RANGE = /^\^(\d+)\.(\d+)\.(\d+)$/;

const PLAIN_RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;

const releaseOf = (request: { readonly match: RegExpExecArray }): Release => ({
  major: Number(request.match[1]),
  minor: Number(request.match[2]),
  patch: Number(request.match[3]),
});

export const caretRangeOf = (request: { readonly range: string }): Result<CaretRange, "not-caret"> => {
  const match = CARET_RANGE.exec(request.range);
  return match === null
    ? { outcome: "failed", error: "not-caret" }
    : { outcome: "ok", value: { floor: request.range.slice(1), ...releaseOf({ match }) } };
};

const spanOf = (request: { readonly range: CaretRange }): CaretSpan => {
  if (request.range.major > 0) {
    return "same-major";
  }
  return request.range.minor > 0 ? "same-minor" : "same-patch";
};

const insideSpan = (request: { readonly range: CaretRange; readonly release: Release }): CaretFit => {
  const span = spanOf(request);
  const sameMajor = request.release.major === request.range.major;
  const sameMinor = sameMajor && request.release.minor === request.range.minor;
  switch (span) {
    case "same-major":
      return sameMajor ? "within" : "outside";
    case "same-minor":
      return sameMinor ? "within" : "outside";
    case "same-patch":
      return sameMinor && request.release.patch === request.range.patch ? "within" : "outside";
  }
};

const releaseOrder = (request: { readonly left: Release; readonly right: Release }): number =>
  [request.left.major - request.right.major, request.left.minor - request.right.minor, request.left.patch - request.right.patch].find(
    (difference) => difference !== 0,
  ) ?? 0;

export const caretFitOf = (request: { readonly range: CaretRange; readonly version: string }): CaretFit => {
  const match = PLAIN_RELEASE.exec(request.version);
  if (match === null) {
    return "outside";
  }
  const release = releaseOf({ match });
  return releaseOrder({ left: release, right: request.range }) < 0 ? "outside" : insideSpan({ range: request.range, release });
};

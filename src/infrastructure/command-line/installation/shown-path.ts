import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { PackageLink } from "./package-link.ts";

type ShownRequest = {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath | undefined;
  readonly link: PackageLink;
};

const NATIVE_SEPARATOR = "\\";

const SHOWN_SEPARATOR = "/";

const PARENT_FOLDER = "..";

const insidePackage = (request: { readonly within: string }): "inside" | "outside" =>
  request.within === PARENT_FOLDER || request.within.startsWith(`${PARENT_FOLDER}${SHOWN_SEPARATOR}`) ? "outside" : "inside";

const throughLink = (request: ShownRequest & { readonly target: string }): string => {
  if (request.link.kind === "unlinked") {
    return request.target;
  }
  const location = request.path.relative({ from: request.link.installRoot, to: request.target });
  return location.relation === "within-root" && insidePackage({ within: location.path }) === "inside"
    ? request.path.join({ segments: [request.link.linkRoot, location.path] })
    : request.target;
};

export const shownPathOf = (request: ShownRequest & { readonly target: string }): string => {
  const target = throughLink(request);
  const location = request.repoRoot === undefined ? undefined : request.path.relative({ from: request.repoRoot, to: target });
  return location?.relation === "within-root" ? location.path : target.replaceAll(NATIVE_SEPARATOR, SHOWN_SEPARATOR);
};

const shownRunnerFailureOf = (request: ShownRequest & { readonly failure: RunnerFailure }): RunnerFailure => {
  const { failure } = request;
  switch (failure.kind) {
    case "piece-invalid":
      return { ...failure, pieceRoot: shownPathOf({ ...request, target: failure.pieceRoot }) };
    case "toolchain-shadowed":
      return {
        ...failure,
        location: shownPathOf({ ...request, target: failure.location }),
        installRoot: shownPathOf({ ...request, target: failure.installRoot }),
      };
    default:
      return failure;
  }
};

export const shownFailureOf = (request: ShownRequest & { readonly failure: LoadFailure }): LoadFailure => {
  const { failure } = request;
  switch (failure.kind) {
    case "file-unreadable":
    case "file-malformed":
    case "file-unwritable":
    case "why-chains-required":
    case "records-unsplittable":
    case "unsupported-version":
    case "rule-set-invalid":
      return { ...failure, path: shownPathOf({ ...request, target: failure.path }) };
    case "records-in-both-layouts":
      return {
        ...failure,
        path: shownPathOf({ ...request, target: failure.path }),
        folder: shownPathOf({ ...request, target: failure.folder }),
      };
    case "runner-failed":
      return { ...failure, failure: shownRunnerFailureOf({ ...request, failure: failure.failure }) };
    default:
      return failure;
  }
};

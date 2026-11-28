import { gatheredOutcomes, listedOutcome } from "../../domain/gathered-outcomes.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { ProjectedFile, ProjectionEntry } from "../../domain/runner/checks-run-report.ts";
import type { ProjectionWrite } from "../../domain/runner/runner-result-types.ts";
import type { FileRemovalPort } from "../ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";

type FileWrite = {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
  readonly projected: ProjectedFile;
};

const existingTextOf = (request: {
  readonly fileText: FileTextPort;
  readonly location: string;
}): Result<string | undefined, RunLoadFailure> => {
  if (request.fileText.exists({ path: request.location }) === "absent") {
    return { outcome: "ok", value: undefined };
  }
  const read = request.fileText.read({ path: request.location });
  return read.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "file-unreadable", path: request.location, detail: read.error.detail },
      }
    : { outcome: "ok", value: read.value.replaceAll("\r\n", "\n") };
};

const writtenFileOf = (request: FileWrite): Result<ProjectionWrite, RunLoadFailure> => {
  const { projected } = request;
  const location = request.path.join({ segments: [request.repoRoot, projected.file] });
  const existing = existingTextOf({ fileText: request.fileText, location });
  if (existing.outcome === "failed") {
    return existing;
  }
  if (existing.value === projected.text) {
    return { outcome: "ok", value: { path: projected.file, effect: "unchanged" } };
  }
  const written = request.fileText.write({ path: location, text: projected.text });
  return written.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "file-unwritable", path: location, detail: written.error.detail },
      }
    : { outcome: "ok", value: { path: projected.file, effect: "written" } };
};

const removeFile = (request: {
  readonly fileRemoval: FileRemovalPort;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
  readonly projected: Extract<ProjectionEntry, { readonly kind: "remove" }>;
}): Result<ProjectionWrite, RunLoadFailure> => {
  const { file } = request.projected;
  const location = request.path.join({ segments: [request.repoRoot, file] });
  const removed = request.fileRemoval.remove({ path: location });
  return removed.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "file-unremovable", file, detail: removed.error.detail },
      }
    : { outcome: "ok", value: { path: file, effect: "removed" } };
};

export const applyProjectionEntries = (request: {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
  readonly files: readonly ProjectionEntry[];
}): Result<readonly ProjectionWrite[], RunLoadFailure> => {
  const written = gatheredOutcomes({
    outcomes: request.files
      .filter((projected) => projected.kind === "write")
      .map((projected) => listedOutcome({ outcome: writtenFileOf({ ...request, projected }) })),
  });
  if (written.outcome === "failed") return written;

  return gatheredOutcomes({
    outcomes: [
      written,
      ...request.files
        .filter((projected) => projected.kind === "remove")
        .map((projected) => listedOutcome({ outcome: removeFile({ ...request, projected }) })),
    ],
  });
};

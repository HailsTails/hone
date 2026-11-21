import type { ProjectedFile } from "../../domain/runner/checks-run-report.ts";
import type { ProjectionWrite } from "../../domain/runner/runner-result-types.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { gatheredOutcomes, listedOutcome } from "../../domain/gathered-outcomes.ts";
import type { Result } from "../../domain/result.ts";

type FileWrite = {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
  readonly projected: ProjectedFile;
};

const existingTextOf = (request: { readonly fileText: FileTextPort; readonly location: string }): Result<string | undefined, RunLoadFailure> => {
  if (request.fileText.exists({ path: request.location }) === "absent") {
    return { outcome: "ok", value: undefined };
  }
  const read = request.fileText.read({ path: request.location });
  return read.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unreadable", path: request.location, detail: read.error.detail } }
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
    ? { outcome: "failed", error: { kind: "file-unwritable", path: location, detail: written.error.detail } }
    : { outcome: "ok", value: { path: projected.file, effect: "written" } };
};

export const projectedFilesWrittenOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
  readonly files: readonly ProjectedFile[];
}): Result<readonly ProjectionWrite[], RunLoadFailure> =>
  gatheredOutcomes({ outcomes: request.files.map((projected) => listedOutcome({ outcome: writtenFileOf({ ...request, projected }) })) });

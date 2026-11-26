import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { ProjectionKind } from "../../../../../application/ports/settings/settings-file-format.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { listChecksProjectionOutputs, PROJECTION_KINDS } from "../projection/projection-kinds.ts";
import { type ChecksSlices, joinSlicePath } from "./checks-slices.ts";

export const findLeftOverProjectionFiles = (request: {
  readonly projectionKind: ProjectionKind;
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly path: Pick<PathPort, "join">;
  readonly slices: ChecksSlices;
}): readonly RepoPath[] => {
  const otherNames = PROJECTION_KINDS.filter((kind) => kind !== request.projectionKind).flatMap(
    listChecksProjectionOutputs,
  );
  const { fileText, path, repoRoot } = request;
  return [request.slices.root, ...request.slices.packages]
    .flatMap(({ directory }) => otherNames.map((name) => joinSlicePath({ directory, name })))
    .filter(
      (file) => fileText.exists({ path: path.join({ segments: [repoRoot, file] }) }) === "present",
    );
};

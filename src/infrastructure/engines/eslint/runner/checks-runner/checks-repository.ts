import type { FileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { type PackageScriptsReader, packageScriptsReaderOf } from "../native-exceptions/package-script-scanner.ts";
import { type ProjectionFiles, projectionFilesOver } from "../projection/projection.ts";
import { type LinesReader, linesReaderOf } from "../lint-findings/source-lines.ts";
import { type SuppressionsReader, suppressionsReaderOf } from "../native-exceptions/suppressions-scanner.ts";

export type ChecksRepository = {
  readonly projectionFiles: ProjectionFiles;
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly sourceLines: LinesReader;
};

export const checksRepositoryOver = (request: {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): ChecksRepository => ({
  projectionFiles: projectionFilesOver(request),
  packageScriptsAt: packageScriptsReaderOf(request),
  suppressionsAt: suppressionsReaderOf(request),
  sourceLines: linesReaderOf(request),
});

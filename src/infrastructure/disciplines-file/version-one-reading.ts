import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import type {
  RecordsOnDisk,
  VersionOneRead,
  VersionOneReadFailure,
} from "../../application/ports/records/version-one-reading.ts";
import type { SelectionRepository } from "../../application/ports/selection/selection-repository.ts";
import { UNMEASURED_EXCEPTION_BASELINE } from "../../domain/records/discipline-exceptions/exception-baseline.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { Result } from "../../domain/result.ts";
import { headRecordsOf } from "../discipline-exceptions-folder/head-records.ts";
import { readSelectionFile, selectionFilePathOf } from "./selection-reader.ts";

const VERSION_ONE_SETTINGS = repoPathOf("disciplines.json");

export type VersionOneReadRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly selectionRepository: SelectionRepository;
  readonly exceptionRepository: Pick<ExceptionRepository, "read">;
  readonly recordsOnDisk: RecordsOnDisk;
};

export const versionOneReadOf = (
  request: VersionOneReadRequest,
): Result<VersionOneRead, VersionOneReadFailure> => {
  const unreadable = (failure: LoadFailure): Result<never, VersionOneReadFailure> => ({
    outcome: "failed",
    error: { kind: "version-one-unreadable", failure },
  });
  const file = readSelectionFile({
    fileText: request.fileText,
    path: selectionFilePathOf({ path: request.path, repoRoot: request.repoRoot }),
  });
  if (file.outcome === "failed") {
    return unreadable(file.error);
  }
  const selected = request.selectionRepository.read({});
  if (selected.outcome === "failed") {
    return unreadable(selected.error);
  }
  const entries = request.exceptionRepository.read();
  if (entries.outcome === "failed") {
    return unreadable(entries.error);
  }
  const heads = headRecordsOf({
    entries: entries.value,
    selection: selected.value.selection,
    fileExceptionWhyChains: selected.value.fileExceptionWhyChains,
    baseline: UNMEASURED_EXCEPTION_BASELINE,
  });
  if (heads.outcome === "failed") {
    return { outcome: "failed", error: { kind: "records-refused", refusal: heads.error } };
  }
  return {
    outcome: "ok",
    value: {
      reading: { selection: file.value, heads: heads.value },
      versionOneFiles: {
        recordsFiles: request.recordsOnDisk.files,
        recordsFolders: request.recordsOnDisk.folders,
        recordsRoot: request.recordsOnDisk.root,
        settings: VERSION_ONE_SETTINGS,
      },
    },
  };
};

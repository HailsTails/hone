import type { SelectionRepository } from "./consumer-selection.ts";
import { readSelectionFile, selectionFilePathOf } from "./selection-reader.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { FileTextPort } from "../node/file-system/file-text-port.ts";
import type { PathPort } from "../node/path-port.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import { type HeadRecordsRefusal, headRecordsOf } from "../discipline-exceptions-folder/head-records.ts";
import { type ExceptionRepository, UNMEASURED_EXCEPTION_BASELINE } from "../discipline-exceptions-folder/exception-records.ts";
import type { VersionOneReading } from "../../application/upgrade/proof/upgrade-plan.ts";
import type { VersionOneFiles } from "../../application/upgrade/proof/upgrade-proof.ts";
import type { RecordsOnDisk } from "../discipline-exceptions-folder/version-one-records-on-disk.ts";

const VERSION_ONE_SETTINGS = repoPathSchema.parse("disciplines.json");

export type VersionOneRead = { readonly reading: VersionOneReading; readonly versionOneFiles: VersionOneFiles };

export type VersionOneReadFailure =
  | { readonly kind: "version-one-unreadable"; readonly failure: LoadFailure }
  | { readonly kind: "records-refused"; readonly refusal: HeadRecordsRefusal };

export type VersionOneReadRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly selectionRepository: SelectionRepository;
  readonly exceptionRepository: Pick<ExceptionRepository, "read">;
  readonly recordsOnDisk: RecordsOnDisk;
};

export const versionOneReadOf = (request: VersionOneReadRequest): Result<VersionOneRead, VersionOneReadFailure> => {
  const unreadable = (failure: LoadFailure): Result<never, VersionOneReadFailure> => ({ outcome: "failed", error: { kind: "version-one-unreadable", failure } });
  const file = readSelectionFile({ fileText: request.fileText, path: selectionFilePathOf({ path: request.path, repoRoot: request.repoRoot }) });
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

import type { GitPort } from "../../application/ports/git-port.ts";
import type { FoundTreeExceptions } from "../../application/ports/records/exception-repository.ts";
import type { FoundTreeRecordsSourceOf } from "../../application/ports/records/records-source-of.ts";
import type { RecordsSource } from "../../application/ports/records/records-source.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { baseStandingRecordsSource } from "./base-standing-records-source.ts";
import { versionOneEntriesOf } from "./version-one-entries.ts";

export const foundTreeRecordsSourceOver = (request: {
  readonly source: RecordsSource;
  readonly exceptions: FoundTreeExceptions;
  readonly git: Pick<GitPort, "textInBase">;
  readonly repoRoot: AbsolutePath;
  readonly catalogue: SymptomCatalogue;
}): RecordsSource =>
  baseStandingRecordsSource({
    source: { read: request.source.read, readAt: () => ({ outcome: "ok", value: [] }) },
    entries: versionOneEntriesOf({
      repository: request.exceptions,
      git: request.git,
      repoRoot: request.repoRoot,
    }),
    catalogue: request.catalogue,
  });

export const foundTreeRecordsSourceOf: FoundTreeRecordsSourceOf = (request) => (folder) =>
  foundTreeRecordsSourceOver({
    source: request.recordsSourceOf(folder),
    exceptions: request.exceptionsOf({ repoRoot: folder.repoRoot }),
    git: folder.git,
    repoRoot: folder.repoRoot,
    catalogue: folder.catalogue,
  });

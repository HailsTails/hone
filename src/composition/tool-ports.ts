import type { NamedEnginePort } from "../application/ports/engine/engine-port.ts";
import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../application/ports/file-system/directory-removal-port.ts";
import type { EntryKindPort } from "../application/ports/file-system/entry-kind-port.ts";
import type { FileCreationPort } from "../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../application/ports/file-system/file-removal-port.ts";
import type { GitTreePort } from "../application/ports/git-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { RecordsEditor } from "../application/ports/records/records-editor.ts";
import type { RecordsReader } from "../application/ports/records/records-reader.ts";
import type {
  FoundTreeRecordsSourceOf,
  RecordsSourceOf,
} from "../application/ports/records/records-source-of.ts";
import type { LoadFailureDetail } from "../application/ports/report/load-failure-detail.ts";
import type {
  CheckPieceSourceOf,
  SettingsSourcesOf,
} from "../application/ports/settings-sources.ts";
import type { SettingsFileFormat } from "../application/ports/settings/settings-file-format.ts";
import type { BoundCatalogueOf } from "../application/ports/symptom-catalogue-repository.ts";
import type { VersionOneProjectionPortOf } from "../application/ports/upgrade/version-one-projection-port.ts";
import type { VersionOneCommandPorts } from "../application/ports/version-one-command-request.ts";
import type { StagesOver } from "./version-two-stages.ts";

export type ToolInvocation = {
  readonly process: ProcessPort;
  readonly moduleUrl: string;
};

export type VersionOneToolPorts = Omit<VersionOneCommandPorts, "moduleUrl">;

export type ToolPorts = VersionOneToolPorts & {
  readonly gitTree: GitTreePort;
  readonly namedEngine: NamedEnginePort;
  readonly directory: DirectoryPort;
  readonly stagesOver: StagesOver;
  readonly recordsSourceOf: RecordsSourceOf;
  readonly foundTreeRecordsSourceOf: FoundTreeRecordsSourceOf;
  readonly recordsReader: RecordsReader;
  readonly recordsEditor: RecordsEditor;
  readonly fileCreation: FileCreationPort;
  readonly fileRemoval: FileRemovalPort;
  readonly directoryRemoval: DirectoryRemovalPort;
  readonly entryKind: EntryKindPort;
  readonly loadFailureDetail: LoadFailureDetail;
  readonly boundCatalogueOf: BoundCatalogueOf;
  readonly settingsFormat: SettingsFileFormat;
  readonly settingsSourcesOf: SettingsSourcesOf;
  readonly checkPieceSourceOf: CheckPieceSourceOf;
  readonly versionOneProjectionOf: VersionOneProjectionPortOf;
};

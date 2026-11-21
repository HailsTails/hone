import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { DirectoryPort } from "../file-system/directory-port.ts";
import type { FileTextPort } from "../file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../git-port.ts";
import type { PathPort } from "../host/path-port.ts";
import type { ExceptionRepository } from "./exception-repository.ts";
import type { RecordsSource } from "./records-source.ts";

export type RecordsFolderPorts = {
  readonly fileText: Pick<FileTextPort, "exists" | "read">;
  readonly path: Pick<PathPort, "join">;
  readonly directory: Pick<DirectoryPort, "list">;
  readonly git: Pick<GitPort, "textInBase">;
  readonly gitTree: GitTreePort;
};

export type RecordsSourceOf = (request: RecordsFolderPorts & { readonly repoRoot: AbsolutePath; readonly catalogue: SymptomCatalogue }) => RecordsSource;

export type FoundTreeRecordsSourceOf = (request: {
  readonly recordsSourceOf: RecordsSourceOf;
  readonly exceptionsOf: (request: { readonly repoRoot: AbsolutePath }) => Pick<ExceptionRepository, "readAt">;
}) => RecordsSourceOf;

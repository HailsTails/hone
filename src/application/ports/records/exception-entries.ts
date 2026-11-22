import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { ExceptionBaseline } from "../../../domain/records/discipline-exceptions/exception-baseline.ts";
import type { PlacedEntry, StructuralExceptionEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionReading } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { FileExceptionWhyChains } from "../../../domain/settings/selection/file-exception-why-chains.ts";
import type { Selection } from "../../../domain/settings/selection/selection.ts";

export type ExceptionEntryParser = {
  readonly parseExceptionEntries: (request: {
    readonly entries: readonly PlacedEntry[];
    readonly selection: Selection;
    readonly baseline: ExceptionBaseline;
    readonly fileExceptionWhyChains: FileExceptionWhyChains;
  }) => ExceptionReading;
  readonly importedEntriesIn: (request: { readonly entries: readonly StructuralExceptionEntry[] }) => "present" | "absent";
  readonly importSourcesOf: (request: { readonly entries: readonly StructuralExceptionEntry[] }) => readonly RepoPath[];
};

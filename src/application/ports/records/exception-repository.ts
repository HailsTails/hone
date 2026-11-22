import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { GitFailure } from "../../../domain/repository/git-failure.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { DebtPair } from "../../../domain/records/discipline-exceptions/debt-pair.ts";
import type { PlacedEntry, StructuralExceptionEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import type { FileCarveOutEntry } from "../../../domain/records/discipline-exceptions/exception-record.ts";

export type RecordsWrite = { readonly path: RepoPath; readonly effect: "written" | "removed" };

export type RecordsSplit =
  | { readonly effect: "split"; readonly writes: readonly RecordsWrite[] }
  | { readonly effect: "already-split" | "no-records"; readonly path: RepoPath };

export type ExceptionRepository = {
  readonly read: () => Result<readonly PlacedEntry[], LoadFailure>;
  readonly readAt: (request: { readonly revision: string }) => Result<readonly StructuralExceptionEntry[], GitFailure>;
  readonly add: (request: { readonly entries: readonly FileCarveOutEntry[] }) => Result<void, LoadFailure>;
  readonly remove: (request: { readonly pairs: readonly DebtPair[] }) => Result<readonly DebtPair[], LoadFailure>;
  readonly moveToSplitLayout: () => Result<RecordsSplit, LoadFailure>;
};

export type FoundTreeExceptions = {
  readonly readAt: () => Result<readonly StructuralExceptionEntry[], GitFailure>;
};

export type ExceptionRepositoryOf = (request: { readonly repoRoot: AbsolutePath }) => ExceptionRepository;

import type { DebtOutcome } from "../../../domain/records/debt/debt-effects.ts";
import type { PrunableDebt } from "../../../domain/records/debt/prunable-debt.ts";
import type { PlacedRecord } from "../../../domain/records/hone-records/hone-record.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { RunUnmeasured } from "../../../domain/report/run-report.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type SmoothingStep = "project" | "remove-carried" | "record-debt" | "prune-debt";

export type ChangedFile = { readonly file: RepoPath; readonly text: string };

export type SmoothingChanges = {
  readonly write: readonly ChangedFile[];
  readonly remove: readonly RepoPath[];
};

export type SmoothingFailure =
  | { readonly kind: "run-failed"; readonly failure: RunLoadFailure }
  | { readonly kind: "run-unmeasured"; readonly unmeasured: readonly RunUnmeasured[] };

export type CommandSmoothed<Done> = { readonly changes: SmoothingChanges; readonly done: Done };

export type SmoothingWritten = { readonly written: readonly RepoPath[] };

type SmoothingCommand<Done> = (
  request: SmoothingWritten,
) => Promise<Result<Done, SmoothingFailure>>;

export type SmoothingCommands = {
  readonly project: SmoothingCommand<SmoothingChanges>;
  readonly removeCarried: SmoothingCommand<CommandSmoothed<readonly PlacedRecord[]>>;
  readonly recordDebt: SmoothingCommand<CommandSmoothed<readonly DebtOutcome[]>>;
  readonly pruneDebt: SmoothingCommand<CommandSmoothed<readonly PrunableDebt[]>>;
};

import type { AbsolutePath } from "../../repository/absolute-path-types.ts";
import type { RunnerClause } from "../../runner/runner-module-types.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import type { ClauseEditionReading } from "../../rule-set/edition-types.ts";
import type { FileExceptionWhyChains } from "./file-exception-why-chains.ts";
import type { EngineId } from "../../rule-set/identifier-types.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { ClauseExceptions } from "../../rule-set/rule-set-types.ts";
import type { AddressedCheck } from "../../language-layer/check-address-text.ts";

export type SelectedClause = {
  readonly address: ClauseAddress;
  readonly mechanism: EngineId;
  readonly exceptions: ClauseExceptions;
};

export type { ClauseEditionReading } from "../../rule-set/edition-types.ts";

export type Selection = {
  readonly selected: readonly SelectedClause[];
  readonly uncovered: readonly ClauseAddress[];
  readonly notAdopted: readonly ClauseAddress[];
  readonly notRun: readonly ClauseAddress[];
  readonly editions: readonly ClauseEditionReading[];
};

export type VersionTwoSelection = Omit<Selection, "uncovered">;

export type ClauseRoot = {
  readonly clause: ClauseAddress;
  readonly ruleSetRoot: AbsolutePath;
  readonly checks: readonly AddressedCheck[];
};

export type ClauseBinding = {
  readonly mechanism: EngineId;
  readonly clause: RunnerClause;
};

export type SelectionReading = {
  readonly selection: Selection;
  readonly bindings: readonly ClauseBinding[];
  readonly clauseRoots: readonly ClauseRoot[];
  readonly excluded: readonly RepoPath[];
  readonly eslintConfigRoots: readonly RepoPath[];
  readonly fileExceptionWhyChains: FileExceptionWhyChains;
};

export type VersionTwoSelectionReading = Omit<SelectionReading, "selection"> & { readonly selection: VersionTwoSelection };

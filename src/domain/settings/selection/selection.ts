import type { AbsolutePath } from "../../repository/absolute-path-types.ts";
import type { RunnerClause } from "../../runner/runner-module-types.ts";
import type { ClauseAddress } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { ClauseEditionReading } from "../../rule-set/edition-types.ts";
import type { FileExceptionWhyChains } from "./file-exception-why-chains.ts";
import type { MechanismId } from "../../rule-set/identifier-types.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ClauseExceptions } from "../../rule-set/rule-set-types.ts";

export type SelectedClause = {
  readonly address: ClauseAddress;
  readonly mechanism: MechanismId;
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

export type ClauseRoot = {
  readonly clause: ClauseAddress;
  readonly ruleSetRoot: AbsolutePath;
};

export type ClauseBinding = {
  readonly mechanism: MechanismId;
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

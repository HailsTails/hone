import type { AbsolutePath } from "../../../infrastructure/content-files/absolute-path.ts";
import type { RunnerClause } from "../../../infrastructure/engines/protocol/runner-module/runner-module-schema.ts";
import type { ClauseAddress } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { ClauseEditionReading } from "../../rule-set/edition-types.ts";
import type { FileExceptionWhyChains } from "../../../infrastructure/hone-config-file/file-exception-why-chains.ts";
import type { MechanismId } from "../../../infrastructure/hone-config-file/identifiers.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ClauseExceptions } from "../../../infrastructure/content-files/rule-sets/rule-set-reader.ts";

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

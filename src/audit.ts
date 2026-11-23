import * as editionReach from "./domain/rule-set/edition-reach.ts";
import * as sourceScope from "./infrastructure/engines/walker/runner/pieces/source-scope.ts";

export type { CheckBinding } from "./domain/runner/check-binding.ts";
export type { PieceFailure } from "./domain/runner/piece-failure-types.ts";
export type { ClauseSettingValues, RunnerClause } from "./domain/runner/runner-module-types.ts";
export type { ReadonlyJsonValue } from "./domain/settings/json-values/json-value.ts";
export type { Edition, EditionReach } from "./domain/rule-set/edition-types.ts";
export type { Hit, Remedy } from "./domain/runner/runner-result-types.ts";
export type { Anchor, AnchorKind } from "./domain/finding/anchor.ts";
export type { ClauseAddress, ToolRuleSet } from "./domain/rule-set/clause-address-types.ts";
export type { ClauseId, DisciplineId, RuleSetName } from "./domain/rule-set/identifier-types.ts";
export type { RepoPath } from "./domain/repository/repo-path-types.ts";
export type { Result } from "./domain/result.ts";
export type {
  CommentRange,
  SyntaxApi,
  SyntaxNode,
  SyntaxTree,
} from "./infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";
export type {
  PieceHit,
  PreparedFileCheck,
  PreparedWalkerCheck,
  SourceObservers,
  WalkerDisk,
  WalkerFile,
  WalkerPiece,
  WalkerRepository,
} from "./infrastructure/engines/walker/runner/pieces/walker-piece.ts";

export const folderScope = sourceScope.folderScope;

export const editionReaches = editionReach.editionReaches;

export const isEdition = editionReach.isEdition;

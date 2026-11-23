import * as editionReach from "./domain/rule-set/edition-reach.ts";
import * as ruleSetIdentifiers from "./domain/rule-set/identifiers.ts";
import * as testFiles from "./domain/settings/test-files.ts";
import type { TestFiles } from "./domain/settings/test-files.ts";
import * as sourceScope from "./infrastructure/engines/walker/runner/pieces/source-scope.ts";

export type { CheckBinding, CheckSettingValues } from "./domain/runner/check-binding.ts";
export type { CheckAddressText } from "./domain/language-layer/check-address-text.ts";
export type { PieceFailure } from "./domain/runner/piece-failure-types.ts";
export type { ReadonlyJsonValue } from "./domain/settings/json-values/json-value.ts";
export type { Edition, EditionReach } from "./domain/rule-set/edition-types.ts";
export type { Remedy } from "./domain/runner/runner-result-types.ts";
export type { Anchor, AnchorKind } from "./domain/finding/anchor.ts";
export type { RuleSetIdentity } from "./domain/rule-set/clause-address-types.ts";
export type { RuleSetName } from "./domain/rule-set/identifier-types.ts";
export type { RepoPath } from "./domain/repository/repo-path-types.ts";
export type { TestFiles } from "./domain/settings/test-files.ts";
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

export const isRuleSetName = ruleSetIdentifiers.isRuleSetName;

export const DEFAULT_TEST_FILES: TestFiles = testFiles.DEFAULT_TEST_FILES;

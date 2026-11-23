import type { AnchorKind } from "../../../domain/finding/anchor.ts";
import type { CheckNames } from "../../../domain/language-layer/check-address-text.ts";
import type { RecordKind } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import type { ClauseEditions } from "../../../domain/rule-set/edition-types.ts";
import type { EngineId, RuleSetName } from "../../../domain/rule-set/identifier-types.ts";
import type {
  ClauseExceptions,
  ClauseSettingDeclarations,
  SourceCase,
} from "../../../domain/rule-set/rule-set-types.ts";
import type {
  ConsumerSelectionFile,
  RuleSetLocation,
} from "../../../domain/settings/selection/selection-file.ts";

export type PieceFolderFile = { readonly file: RepoPath; readonly text: string };

export type VersionOnePiece = {
  readonly mechanism: EngineId;
  readonly settings: unknown;
  readonly checkSettings: ClauseSettingDeclarations;
  readonly editions: ClauseEditions;
  readonly folder: RepoPath;
  readonly module: RepoPath;
  readonly files: readonly PieceFolderFile[];
};

export type SpecifierRefusal = {
  readonly reason: "specifier-not-literal" | "target-not-moved";
  readonly line: number;
};

export type ImportsRewrittenOf = (request: {
  readonly text: string;
  readonly file: RepoPath;
  readonly movedTo: RepoPath;
  readonly folder: RepoPath;
  readonly moved: ReadonlyMap<RepoPath, RepoPath>;
}) => Result<string, SpecifierRefusal>;

export type ImportsRewriterOf = () => Promise<Result<ImportsRewrittenOf, LoadFailure>>;

export type ClauseNaming =
  | { readonly naming: "named"; readonly check: CheckNames; readonly title: string }
  | { readonly naming: "unnamed" };

export type VersionOneTeamClause = {
  readonly clause: ClauseAddress;
  readonly naming: ClauseNaming;
  readonly summary: string;
  readonly anchor: AnchorKind;
  readonly exceptions: ClauseExceptions;
  readonly cases: { readonly flag: readonly SourceCase[]; readonly allow: readonly SourceCase[] };
  readonly pieces: readonly VersionOnePiece[];
};

export type TeamDefinitionKind = "principle" | "rule" | "case" | "symptom";

export type TeamDefinitionAddress = {
  readonly kind: TeamDefinitionKind;
  readonly name: string;
};

export type TeamDefinition = TeamDefinitionAddress & {
  readonly title: string;
  readonly facts: Readonly<Record<string, unknown>>;
  readonly refers: readonly TeamDefinitionAddress[];
};

export type VersionOneTeamLayout = {
  readonly ruleSet: { readonly name: RuleSetName };
  readonly location: RuleSetLocation;
  readonly namesFile: RepoPath;
  readonly clauses: readonly VersionOneTeamClause[];
  readonly definitions: readonly TeamDefinition[];
  readonly versionOneFiles: readonly RepoPath[];
};

export type ItemTextOf = (request: { readonly title: string; readonly facts: unknown }) => string;

export type TeamRuleSetsRequest = {
  readonly selection: ConsumerSelectionFile;
  readonly toolRecordKinds: readonly RecordKind[];
};

export type VersionOneTeamLayoutsOf = (
  request: TeamRuleSetsRequest,
) => Result<readonly VersionOneTeamLayout[], LoadFailure>;

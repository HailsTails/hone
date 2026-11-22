import type { AnchorKind } from "../finding/anchor.ts";
import type { ClauseExceptions, ClauseSettingDeclarations } from "./authored-rule-set-types.ts";
import type { ClauseId, DisciplineId, MechanismId } from "./identifier-types.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { ClauseEditions, Edition } from "./edition-types.ts";

export type { ClauseExceptions, ClauseSettingDeclaration, ClauseSettingDeclarations } from "./authored-rule-set-types.ts";

export type SourceCase = {
  readonly name: string;
  readonly fileName: RepoPath;
  readonly source: string;
  readonly expectedLines: readonly number[];
  readonly edition?: Edition | undefined;
};

export type ClauseDefinition =
  | {
      readonly kind: "mechanical";
      readonly id: ClauseId;
      readonly mechanisms: readonly MechanismId[];
      readonly anchor: AnchorKind;
      readonly exceptions: ClauseExceptions;
      readonly cases: {
        readonly flag: readonly SourceCase[];
        readonly allow: readonly SourceCase[];
      };
    }
  | {
      readonly kind: "judgement";
      readonly id: ClauseId;
      readonly enforcedBy: "review";
    };

export type DisciplineFile = {
  readonly version: 1;
  readonly id: DisciplineId;
  readonly clauses: readonly ClauseDefinition[];
};

export type PieceFile = {
  readonly version: 1;
  readonly discipline: DisciplineId;
  readonly mechanism: MechanismId;
  readonly clauses: readonly {
    readonly clause: ClauseId;
    readonly settings: unknown;
    readonly clauseSettings: ClauseSettingDeclarations;
    readonly editions: ClauseEditions;
  }[];
};

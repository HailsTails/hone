import type { Anchor } from "../../domain/finding/anchor.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";

export type Remedy = {
  readonly fix: string;
  readonly page: string;
  readonly section: string;
};

export type MeasuredPair = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
};

export type Hit = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
  readonly anchor: Anchor;
  readonly snippet: string;
  readonly remedy?: Remedy;
  readonly importSpecifier?: string;
  readonly check?: string;
};

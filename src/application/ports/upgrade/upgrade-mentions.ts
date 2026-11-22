import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { ProofCarriedOver } from "./proof-outcome.ts";

export type FileMention = {
  readonly file: RepoPath;
  readonly line: number;
};

export type UpgradeCarriedOver = ProofCarriedOver & {
  readonly mentions: readonly FileMention[];
};

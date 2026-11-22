import type { RepoPath } from "../repository/repo-path-types.ts";

export type PieceFailure =
  | { readonly kind: "piece-invalid"; readonly pieceRoot: string; readonly detail: string }
  | { readonly kind: "file-unreadable"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "file-unparseable"; readonly file: RepoPath; readonly detail: string };

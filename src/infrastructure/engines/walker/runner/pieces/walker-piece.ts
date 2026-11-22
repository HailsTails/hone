import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import type { Hit } from "../../../../../domain/runner/runner-result-types.ts";
import type {
  CommentRange,
  SyntaxApi,
  SyntaxNode,
  SyntaxTree,
} from "../toolchain/typescript-parse.ts";

export type PieceHit = Omit<Hit, "file">;

export type WalkerFile = {
  readonly file: RepoPath;
  readonly readText: () => Result<string, PieceFailure>;
};

export type SourceObservers = {
  readonly enter?: (request: { readonly node: SyntaxNode }) => void;
  readonly leave?: (request: { readonly node: SyntaxNode }) => void;
  readonly comment?: (request: { readonly range: CommentRange }) => void;
  readonly finish: () => readonly PieceHit[];
};

export type PreparedFileCheck =
  | { readonly kind: "skipped" }
  | { readonly kind: "complete"; readonly hits: readonly PieceHit[] }
  | {
      readonly kind: "syntax";
      readonly begin: (request: {
        readonly sourceFile: SyntaxTree;
        readonly anchorAt: (request: { readonly position: number }) => Anchor;
      }) => SourceObservers;
    };

export type PreparedWalkerCheck = {
  readonly prepareFile: (request: WalkerFile) => Result<PreparedFileCheck, PieceFailure>;
  readonly finish: () => Result<readonly Hit[], PieceFailure>;
};

export type WalkerDisk = {
  readonly root: string;
  readonly kindAt: (request: { readonly path: string }) => "file" | "directory" | "absent";
  readonly textAt: (request: {
    readonly path: string;
  }) => Result<string, { readonly detail: string }>;
};

export type WalkerRepository = {
  readonly files: readonly RepoPath[];
  readonly exists: (request: { readonly file: RepoPath }) => "present" | "absent";
  readonly disk: WalkerDisk;
};

export type WalkerPiece = {
  readonly prepare: (request: {
    readonly clauses: readonly RunnerClause[];
    readonly repository: WalkerRepository;
    readonly syntaxApi: SyntaxApi;
  }) => Result<PreparedWalkerCheck, PieceFailure>;
};

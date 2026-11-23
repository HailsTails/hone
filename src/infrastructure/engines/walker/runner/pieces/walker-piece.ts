import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import type { TestFiles } from "../../../../../domain/settings/test-files.ts";
import type {
  CommentRange,
  SyntaxApi,
  SyntaxNode,
  SyntaxTree,
} from "../toolchain/typescript-parse.ts";

export type PieceHit = Omit<CheckHit, "file">;

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
  readonly finish: () => Result<readonly CheckHit[], PieceFailure>;
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
  readonly testFiles: TestFiles;
};

export type WalkerPiece = {
  readonly prepare: (request: {
    readonly bindings: readonly CheckBinding[];
    readonly repository: WalkerRepository;
    readonly syntaxApi: SyntaxApi;
  }) => Result<PreparedWalkerCheck, PieceFailure>;
};

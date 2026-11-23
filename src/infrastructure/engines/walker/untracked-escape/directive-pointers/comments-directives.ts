import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import {
  type TrackedCheck,
  type Tracking,
  trackedChecksOf,
  trackingAnywhere,
  trackingAtStart,
} from "../../runner/pieces/tracker-patterns.ts";
import { typeDirectiveReaderFor } from "../../runner/pieces/type-directives.ts";
import type { PieceHit, SourceObservers, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

const TODO_PATTERN = /\/\/\s*TODO\b/;
const LINTER_DIRECTIVE_PATTERN =
  /^(?:\/\/|\/\*)\s*((?:biome-ignore(?:-all|-start|-end)?|(?:eslint|oxlint)-(?:disable(?:-line|-next-line)?|enable)|eslint(?=\s)))\b/;
const textAfter = (request: {
  readonly pattern: RegExp;
  readonly text: string;
}): string | undefined => {
  const marker = request.pattern.exec(request.text);
  return marker === null ? undefined : request.text.slice(marker.index + marker[0].length);
};

const untrackedChecks = (request: {
  readonly trackedChecks: readonly TrackedCheck[];
  readonly text: string;
  readonly tracking: (request: {
    readonly text: string;
    readonly tracked: TrackedCheck;
  }) => Tracking;
}): readonly TrackedCheck[] =>
  request.trackedChecks.filter(
    (tracked) => request.tracking({ text: request.text, tracked }) === "untracked",
  );

type AnchorAt = (request: { readonly position: number }) => Anchor;

type FileContext = {
  readonly sourceFile: SyntaxTree;
  readonly anchorAt: AnchorAt;
  readonly trackedChecks: readonly TrackedCheck[];
};

const hitsFor = (request: {
  readonly untracked: readonly TrackedCheck[];
  readonly anchorAt: AnchorAt;
  readonly position: number;
  readonly snippet: string;
}): readonly PieceHit[] => {
  if (request.untracked.length === 0) return [];
  const anchor = request.anchorAt({ position: request.position });
  return request.untracked.map((tracked) => ({
    check: tracked.binding.address,
    anchor,
    snippet: request.snippet,
  }));
};

const taskHits = (request: FileContext): readonly PieceHit[] => {
  let lineStart = 0;
  return request.sourceFile.text.split("\n").flatMap((line) => {
    const position = lineStart;
    lineStart += line.length + 1;
    const afterTodo = textAfter({ pattern: TODO_PATTERN, text: line });
    if (afterTodo === undefined) return [];
    return hitsFor({
      untracked: untrackedChecks({
        trackedChecks: request.trackedChecks,
        text: afterTodo,
        tracking: trackingAtStart,
      }),
      anchorAt: request.anchorAt,
      position,
      snippet: line.trim(),
    });
  });
};

const sourceObserversFor = (
  request: FileContext & { readonly syntaxApi: SyntaxApi },
): SourceObservers => {
  const { sourceFile, anchorAt, trackedChecks, syntaxApi } = request;
  const typeDirectiveOf = typeDirectiveReaderFor({ sourceFile, syntaxApi });
  const todoHits = taskHits(request);
  const directiveHits: PieceHit[] = [];
  const typeDirectiveHits: PieceHit[] = [];
  const commentHits = (comment: {
    readonly text: string;
    readonly whole: string;
    readonly position: number;
  }): readonly PieceHit[] =>
    hitsFor({
      untracked: untrackedChecks({ trackedChecks, text: comment.text, tracking: trackingAnywhere }),
      anchorAt,
      position: comment.position,
      snippet: comment.whole.trim(),
    });
  return {
    comment: ({ range }) => {
      const whole = sourceFile.text.slice(range.pos, range.end);
      const typeDirective = typeDirectiveOf({ range });
      if (typeDirective !== undefined) {
        typeDirectiveHits.push(
          ...commentHits({ text: typeDirective.tail, whole, position: range.pos }),
        );
        return;
      }
      if (LINTER_DIRECTIVE_PATTERN.exec(whole)?.[1] === undefined) return;
      directiveHits.push(...commentHits({ text: whole, whole, position: range.pos }));
    },
    finish: () => [...todoHits, ...directiveHits, ...typeDirectiveHits],
  };
};

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => {
    const settled = trackedChecksOf({ bindings });
    if (settled.outcome === "failed") return settled;
    const trackedChecks = settled.value;
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file }) => {
          if (sourceEligibility({ file }) === "excluded") {
            return { outcome: "ok", value: { kind: "skipped" } };
          }
          return {
            outcome: "ok",
            value: {
              kind: "syntax",
              begin: ({ sourceFile, anchorAt }) =>
                sourceObserversFor({ sourceFile, anchorAt, trackedChecks, syntaxApi }),
            },
          };
        },
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
};

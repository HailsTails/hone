import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { Result } from "../../../../../domain/result.ts";
import { clauseAddressText } from "../../../../../domain/rule-set/clause-address.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import { stringListClauseSettings } from "../../runner/pieces/piece-clause-settings.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
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
const TRACKED_REFERENCE_PATTERN = /\([^()\s]*\d[^()\s]*\)/g;
const LEADING_TRACKED_REFERENCE_PATTERN = /^\s*(\([^()\s]*\d[^()\s]*\))/;

type TrackedClause = {
  readonly clause: RunnerClause;
  readonly trackers: readonly RegExp[];
};

type Tracking = "tracked" | "untracked";

const compiledTracker = (request: {
  readonly clause: RunnerClause;
  readonly source: string;
}): Result<readonly RegExp[], PieceFailure> => {
  try {
    return { outcome: "ok", value: [new RegExp(request.source)] };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: request.clause.pieceRoot,
        detail: `the clauseSettings of ${clauseAddressText({ address: request.clause.address })} are malformed: trackerPatterns entry ${JSON.stringify(request.source)} is not a regular expression: ${thrown instanceof Error ? thrown.message : String(thrown)}`,
      },
    };
  }
};

const trackedClauseOf = (request: {
  readonly clause: RunnerClause;
}): Result<readonly TrackedClause[], PieceFailure> => {
  const settings = stringListClauseSettings({ clause: request.clause, keys: ["trackerPatterns"] });
  if (settings.outcome === "failed") return settings;
  const trackers = gatheredOutcomes({
    outcomes: settings.value.trackerPatterns.map((source) =>
      compiledTracker({ clause: request.clause, source }),
    ),
  });
  if (trackers.outcome === "failed") return trackers;
  return { outcome: "ok", value: [{ clause: request.clause, trackers: trackers.value }] };
};

const trackedClausesOf = (request: {
  readonly clauses: readonly RunnerClause[];
}): Result<readonly TrackedClause[], PieceFailure> =>
  gatheredOutcomes({ outcomes: request.clauses.map((clause) => trackedClauseOf({ clause })) });

const chosenReference = (request: {
  readonly references: readonly string[];
  readonly tracked: TrackedClause;
}): Tracking =>
  request.references.some((reference) =>
    request.tracked.trackers.some((tracker) => tracker.test(reference)),
  )
    ? "tracked"
    : "untracked";

const trackingAnywhere = (request: {
  readonly text: string;
  readonly tracked: TrackedClause;
}): Tracking =>
  chosenReference({
    references: Array.from(request.text.matchAll(TRACKED_REFERENCE_PATTERN), (match) => match[0]),
    tracked: request.tracked,
  });

const trackingAtStart = (request: {
  readonly text: string;
  readonly tracked: TrackedClause;
}): Tracking => {
  const reference = LEADING_TRACKED_REFERENCE_PATTERN.exec(request.text)?.[1];
  return chosenReference({
    references: reference === undefined ? [] : [reference],
    tracked: request.tracked,
  });
};

const textAfter = (request: {
  readonly pattern: RegExp;
  readonly text: string;
}): string | undefined => {
  const marker = request.pattern.exec(request.text);
  return marker === null ? undefined : request.text.slice(marker.index + marker[0].length);
};

const untrackedClauses = (request: {
  readonly trackedClauses: readonly TrackedClause[];
  readonly text: string;
  readonly tracking: (request: {
    readonly text: string;
    readonly tracked: TrackedClause;
  }) => Tracking;
}): readonly TrackedClause[] =>
  request.trackedClauses.filter(
    (tracked) => request.tracking({ text: request.text, tracked }) === "untracked",
  );

type AnchorAt = (request: { readonly position: number }) => Anchor;

type FileContext = {
  readonly sourceFile: SyntaxTree;
  readonly anchorAt: AnchorAt;
  readonly trackedClauses: readonly TrackedClause[];
};

const hitsFor = (request: {
  readonly untracked: readonly TrackedClause[];
  readonly anchorAt: AnchorAt;
  readonly position: number;
  readonly snippet: string;
}): readonly PieceHit[] => {
  if (request.untracked.length === 0) return [];
  const anchor = request.anchorAt({ position: request.position });
  return request.untracked.map((tracked) => ({
    clause: tracked.clause.address,
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
      untracked: untrackedClauses({
        trackedClauses: request.trackedClauses,
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
  const { sourceFile, anchorAt, trackedClauses, syntaxApi } = request;
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
      untracked: untrackedClauses({
        trackedClauses,
        text: comment.text,
        tracking: trackingAnywhere,
      }),
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
  prepare: ({ clauses, syntaxApi }) => {
    const settled = trackedClausesOf({ clauses });
    if (settled.outcome === "failed") return settled;
    const trackedClauses = settled.value;
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
                sourceObserversFor({ sourceFile, anchorAt, trackedClauses, syntaxApi }),
            },
          };
        },
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
};

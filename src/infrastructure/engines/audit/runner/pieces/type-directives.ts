import type { InlineDisable } from "../../../../../domain/runner/runner-result-types.ts";
import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import { type ClauseAddress, sameClauseAddress } from "../../../../discipline-exceptions-folder/clause-address.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { CommentRange, SyntaxApi, SyntaxNode, SyntaxTree } from "../toolchain/typescript-parse.ts";

export const TYPE_DIRECTIVES = ["@ts-expect-error", "@ts-ignore", "@ts-nocheck"] as const;

export type TypeDirective = (typeof TYPE_DIRECTIVES)[number];

export type TypeDirectiveReading = { readonly directive: TypeDirective; readonly tail: string };

type CommentPlacement = {
  readonly form: "line" | "block";
  readonly region: "file-header" | "body";
};

type DirectivePattern = { readonly directive: TypeDirective; readonly pattern: RegExp };

const LINE_SUPPRESSIONS: readonly DirectivePattern[] = [
  { directive: "@ts-expect-error", pattern: /^\/\/\/?\s*@ts-expect-error/ },
  { directive: "@ts-ignore", pattern: /^\/\/\/?\s*@ts-ignore/ },
];

const BLOCK_SUPPRESSIONS: readonly DirectivePattern[] = [
  { directive: "@ts-expect-error", pattern: /^\s*[/*]*\s*@ts-expect-error/ },
  { directive: "@ts-ignore", pattern: /^\s*[/*]*\s*@ts-ignore/ },
];

const FILE_SUPPRESSIONS: readonly DirectivePattern[] = [
  { directive: "@ts-nocheck", pattern: /^\/\/\/?\s*@ts-nocheck(?=[\s:]|$)/i },
];

const readingAgainst = (request: {
  readonly patterns: readonly DirectivePattern[];
  readonly text: string;
}): TypeDirectiveReading | undefined =>
  request.patterns.flatMap(({ directive, pattern }): readonly TypeDirectiveReading[] => {
    const marker = pattern.exec(request.text);
    return marker === null ? [] : [{ directive, tail: request.text.slice(marker.index + marker[0].length) }];
  })[0];

const commentPlacementOf = (request: {
  readonly range: CommentRange;
  readonly fileHeaderPositions: ReadonlySet<number>;
  readonly syntaxApi: SyntaxApi;
}): CommentPlacement => ({
  form: request.range.kind === request.syntaxApi.SyntaxKind.MultiLineCommentTrivia ? "block" : "line",
  region: request.fileHeaderPositions.has(request.range.pos) ? "file-header" : "body",
});

const readingByPlacement = (request: {
  readonly comment: string;
  readonly placement: CommentPlacement;
}): TypeDirectiveReading | undefined => {
  const { comment, placement } = request;
  if (placement.form === "block") {
    return readingAgainst({ patterns: BLOCK_SUPPRESSIONS, text: comment.slice(comment.lastIndexOf("\n") + 1) });
  }
  const suppression = readingAgainst({ patterns: LINE_SUPPRESSIONS, text: comment });
  if (suppression !== undefined || placement.region === "body") return suppression;
  return readingAgainst({ patterns: FILE_SUPPRESSIONS, text: comment });
};

export type TypeDirectiveReader = (request: { readonly range: CommentRange }) => TypeDirectiveReading | undefined;

type TextSpan = { readonly pos: number; readonly end: number };

const jsxTextSpansUnder = (request: { readonly node: SyntaxNode; readonly syntaxApi: SyntaxApi }): readonly TextSpan[] => {
  const own: readonly TextSpan[] = request.syntaxApi.isJsxText(request.node) ? [{ pos: request.node.pos, end: request.node.end }] : [];
  const children: SyntaxNode[] = [];
  request.syntaxApi.forEachChild(request.node, (child) => {
    children.push(child);
  });
  return [...own, ...children.flatMap((child) => jsxTextSpansUnder({ node: child, syntaxApi: request.syntaxApi }))];
};

const jsxTextSpansOf = (request: { readonly sourceFile: SyntaxTree; readonly syntaxApi: SyntaxApi }): readonly TextSpan[] =>
  request.sourceFile.languageVariant === request.syntaxApi.LanguageVariant.JSX
    ? jsxTextSpansUnder({ node: request.sourceFile, syntaxApi: request.syntaxApi })
    : [];

type RangePlacement = "jsx-text" | "trivia";

const rangePlacementOf = (request: { readonly range: CommentRange; readonly spans: readonly TextSpan[] }): RangePlacement =>
  request.spans.some((span) => span.pos <= request.range.pos && request.range.end <= span.end) ? "jsx-text" : "trivia";

export const typeDirectiveReaderFor = (request: {
  readonly sourceFile: SyntaxTree;
  readonly syntaxApi: SyntaxApi;
}): TypeDirectiveReader => {
  const { sourceFile, syntaxApi } = request;
  const fileHeaderPositions = new Set(
    (syntaxApi.getLeadingCommentRanges(sourceFile.text, 0) ?? []).map((headerRange) => headerRange.pos),
  );
  const jsxTextSpans = jsxTextSpansOf({ sourceFile, syntaxApi });
  return ({ range }) =>
    rangePlacementOf({ range, spans: jsxTextSpans }) === "jsx-text"
      ? undefined
      : readingByPlacement({
          comment: sourceFile.text.slice(range.pos, range.end),
          placement: commentPlacementOf({ range, fileHeaderPositions, syntaxApi }),
        });
};

export type DirectiveEscape = { readonly clause: ClauseAddress; readonly directives: readonly TypeDirective[] };

export const escapesOf = (request: {
  readonly escapes: readonly DirectiveEscape[];
  readonly clauses: readonly ClauseAddress[];
}): readonly DirectiveEscape[] =>
  request.escapes.filter((directiveEscape) =>
    request.clauses.some((clause) => sameClauseAddress({ left: clause, right: directiveEscape.clause }) === "same"),
  );

export const directiveEscapesIn = (request: {
  readonly sourceFile: SyntaxTree;
  readonly syntaxApi: SyntaxApi;
  readonly file: RepoPath;
  readonly comments: readonly CommentRange[];
  readonly escapes: readonly DirectiveEscape[];
  readonly anchorAt: (request: { readonly position: number }) => Anchor;
}): readonly InlineDisable[] => {
  if (request.escapes.length === 0) return [];
  const readDirective = typeDirectiveReaderFor(request);
  return [...request.comments]
    .sort((left, right) => left.pos - right.pos)
    .flatMap((range) => {
      const reading = readDirective({ range });
      if (reading === undefined) return [];
      const line = request.anchorAt({ position: range.pos }).line;
      const text = request.sourceFile.text.slice(range.pos, range.end).trim();
      return request.escapes
        .filter((directiveEscape) => directiveEscape.directives.includes(reading.directive))
        .map((directiveEscape): InlineDisable => ({ kind: "inline-disable", clause: directiveEscape.clause, file: request.file, line, text, reach: "one-clause" }));
    });
};

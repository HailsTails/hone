import { z } from "zod";

import type { Anchor } from "../../../../domain/finding/anchor.ts";
import type { CheckAddressText } from "../../../../domain/language-layer/check-address-text.ts";
import type { Result } from "../../../../domain/result.ts";
import type {
  CheckHit,
  CheckNativeException,
} from "../../../../domain/runner/check-observations.ts";
import type { PieceFailure } from "../../../../domain/runner/piece-failure-types.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { checkHitSchema } from "../../protocol/checks/check-wire.ts";
import { runnerResultSchema } from "../../protocol/runner-module/runner-result-schema.ts";
import { type DirectiveEscape, directiveEscapesIn, escapesOf } from "./pieces/type-directives.ts";
import type { PieceHit, WalkerFile } from "./pieces/walker-piece.ts";
import type { PreparedWalkerPiece } from "./prepare-walker-pieces.ts";
import type {
  CommentRange,
  SyntaxNode,
  SyntaxTree,
  TypeScriptParsePort,
} from "./toolchain/typescript-parse.ts";

type WalkerDirectiveException = Extract<CheckNativeException, { readonly kind: "inline-disable" }>;

export type WalkerFileObservations = {
  readonly hits: readonly CheckHit[];
  readonly nativeExceptions: readonly WalkerDirectiveException[];
  readonly applicable: readonly CheckAddressText[];
  readonly inapplicable?: readonly CheckAddressText[];
};

export type ObserveWalkerFileRequest = {
  readonly file: WalkerFile;
  readonly pieces: readonly PreparedWalkerPiece[];
  readonly parse: TypeScriptParsePort;
  readonly escapes: readonly DirectiveEscape[];
};

export type ObserveWalkerFileResult = Result<WalkerFileObservations, RunnerFailure>;

type Outcome<Value> = Result<Value, RunnerFailure>;

const pieceHitsSchema = z.array(checkHitSchema.unwrap().omit({ file: true }).readonly());
type PieceCall = (argument: unknown) => unknown;
type PieceFinish = () => unknown;

const callSchema = z.function({ input: [z.unknown()], output: z.unknown() });
const functionSchema = <Callable extends (...observedArguments: never[]) => unknown>() =>
  z.custom<Callable>().superRefine((candidate, refinement) => {
    if (typeof candidate !== "function") {
      refinement.addIssue({ code: "invalid_type", expected: "function", input: candidate });
    }
  });
const fileCheckSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("skipped") }),
  z.object({ kind: z.literal("complete"), hits: pieceHitsSchema }),
  z.object({ kind: z.literal("syntax"), begin: callSchema }),
]);
const filePreparationSchema = runnerResultSchema({ value: fileCheckSchema });
const sourceObserversSchema = z.object({
  enter: functionSchema<PieceCall>().optional(),
  leave: functionSchema<PieceCall>().optional(),
  comment: functionSchema<PieceCall>().optional(),
  finish: functionSchema<PieceFinish>(),
});

type LoadedFileCheck = z.infer<typeof fileCheckSchema>;
type LoadedSourceObservers = z.infer<typeof sourceObserversSchema>;
type FilePiece = {
  readonly piece: PreparedWalkerPiece;
  readonly check: LoadedFileCheck;
};
type ActiveFilePiece = {
  readonly piece: PreparedWalkerPiece;
  readonly completion:
    | { readonly kind: "complete"; readonly hits: readonly PieceHit[] }
    | { readonly kind: "syntax"; readonly observers: LoadedSourceObservers };
};
type SyntaxFilePiece = {
  readonly piece: PreparedWalkerPiece;
  readonly observers: LoadedSourceObservers;
};
type FileTextCache = {
  readonly file: WalkerFile;
  readonly failure: () => RunnerFailure | undefined;
};

const thrownDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const pieceInvalid = (request: {
  readonly piece: PreparedWalkerPiece;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: {
    kind: "piece-invalid",
    pieceRoot: request.piece.bindings[0]?.pieceRoot ?? request.piece.modulePath,
    detail: request.detail,
  },
});

const collect = <Value>(request: {
  readonly outcomes: readonly Outcome<Value>[];
}): Outcome<readonly Value[]> =>
  request.outcomes.reduce<Outcome<readonly Value[]>>(
    (gathered, next) => {
      if (gathered.outcome === "failed") return gathered;
      if (next.outcome === "failed") return next;
      return { outcome: "ok", value: [...gathered.value, next.value] };
    },
    { outcome: "ok", value: [] },
  );

const cachedFile = (request: { readonly file: WalkerFile }): FileTextCache => {
  let text: Result<string, PieceFailure> | undefined;
  return {
    file: {
      file: request.file.file,
      readText: () => {
        text ??= request.file.readText();
        return text;
      },
    },
    failure: () => (text?.outcome === "failed" ? text.error : undefined),
  };
};

const prepareFile = (request: {
  readonly file: WalkerFile;
  readonly piece: PreparedWalkerPiece;
}): Outcome<FilePiece> => {
  try {
    const parsed = filePreparationSchema.safeParse(request.piece.check.prepareFile(request.file));
    if (!parsed.success) return pieceInvalid({ ...request, detail: parsed.error.message });
    if (parsed.data.outcome === "failed") return parsed.data;
    return { outcome: "ok", value: { piece: request.piece, check: parsed.data.value } };
  } catch (thrown) {
    return pieceInvalid({ ...request, detail: thrownDetail({ thrown }) });
  }
};

const parsedSource = (request: {
  readonly file: WalkerFile;
  readonly parse: TypeScriptParsePort;
}): Outcome<SyntaxTree> => {
  const source = request.file.readText();
  if (source.outcome === "failed") return source;
  try {
    return {
      outcome: "ok",
      value: request.parse.parse({ fileName: request.file.file, source: source.value }),
    };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: {
        kind: "file-unparseable",
        file: request.file.file,
        detail: thrownDetail({ thrown }),
      },
    };
  }
};

const anchorAt = (request: { readonly tree: SyntaxTree; readonly position: number }): Anchor => {
  const position = Math.min(Math.max(request.position, 0), request.tree.text.length);
  const location = request.tree.getLineAndCharacterOfPosition(position);
  return { line: location.line + 1, column: location.character };
};

const beginFile = (request: {
  readonly selected: FilePiece;
  readonly tree: SyntaxTree;
}): Outcome<ActiveFilePiece> => {
  const { piece, check } = request.selected;
  if (check.kind === "complete") return { outcome: "ok", value: { piece, completion: check } };
  if (check.kind === "skipped")
    return pieceInvalid({ piece, detail: "a skipped file has no source observers" });
  try {
    const parsed = sourceObserversSchema.safeParse(
      check.begin({
        sourceFile: request.tree,
        anchorAt: (position: { readonly position: number }) =>
          anchorAt({ tree: request.tree, ...position }),
      }),
    );
    if (!parsed.success) return pieceInvalid({ piece, detail: parsed.error.message });
    return {
      outcome: "ok",
      value: { piece, completion: { kind: "syntax", observers: parsed.data } },
    };
  } catch (thrown) {
    return pieceInvalid({ piece, detail: thrownDetail({ thrown }) });
  }
};

const visitSyntax = (request: {
  readonly tree: SyntaxTree;
  readonly parse: TypeScriptParsePort;
  readonly nextNode: () => "visit" | "stop";
  readonly enter: (node: SyntaxNode) => void;
  readonly leave: (node: SyntaxNode) => void;
  readonly comment: (range: CommentRange) => void;
}): void => {
  const emptyMembership = new Set<SyntaxNode>();
  const visit = (frame: {
    readonly node: SyntaxNode;
    readonly relation: "semantic" | "syntax";
    readonly membership: ReadonlySet<SyntaxNode>;
  }): void => {
    if (request.nextNode() === "stop") return;
    if (frame.relation === "semantic") request.enter(frame.node);
    request.parse.syntaxApi
      .getLeadingCommentRanges(request.tree.text, frame.node.pos)
      ?.forEach(request.comment);
    request.parse.syntaxApi
      .getTrailingCommentRanges(request.tree.text, frame.node.end)
      ?.forEach(request.comment);
    const membership =
      frame.relation === "semantic"
        ? new Set(request.parse.children({ node: frame.node }))
        : frame.node.kind === request.parse.syntaxApi.SyntaxKind.SyntaxList
          ? frame.membership
          : emptyMembership;
    frame.node.getChildren(request.tree).forEach((node) => {
      visit({ node, relation: membership.has(node) ? "semantic" : "syntax", membership });
    });
    if (frame.relation === "semantic") request.leave(frame.node);
  };
  visit({ node: request.tree, relation: "semantic", membership: emptyMembership });
};

const observeSource = (request: {
  readonly tree: SyntaxTree;
  readonly file: WalkerFile;
  readonly parse: TypeScriptParsePort;
  readonly sources: readonly SyntaxFilePiece[];
}): Outcome<readonly CommentRange[]> => {
  const seenComments = new Set<number>();
  const comments: CommentRange[] = [];
  let failure: RunnerFailure | undefined;
  const notify = (invoke: (source: SyntaxFilePiece) => unknown): void => {
    request.sources.forEach((source) => {
      if (failure !== undefined) return;
      try {
        invoke(source);
      } catch (thrown) {
        failure = pieceInvalid({ piece: source.piece, detail: thrownDetail({ thrown }) }).error;
      }
    });
  };
  const comment = (range: CommentRange): void => {
    if (seenComments.has(range.pos)) return;
    seenComments.add(range.pos);
    comments.push(range);
    notify((source) => source.observers.comment?.({ range }));
  };
  try {
    visitSyntax({
      tree: request.tree,
      parse: request.parse,
      nextNode: () => (failure === undefined ? "visit" : "stop"),
      enter: (node) => notify((source) => source.observers.enter?.({ node })),
      leave: (node) => notify((source) => source.observers.leave?.({ node })),
      comment,
    });
  } catch (thrown) {
    return {
      outcome: "failed",
      error: {
        kind: "file-unparseable",
        file: request.file.file,
        detail: thrownDetail({ thrown }),
      },
    };
  }
  if (failure !== undefined) return { outcome: "failed", error: failure };
  return { outcome: "ok", value: comments };
};

const attributedHits = (request: {
  readonly piece: PreparedWalkerPiece;
  readonly hits: readonly PieceHit[];
}): Outcome<readonly PieceHit[]> => {
  if (
    request.hits.some(
      (hit) => !request.piece.bindings.some((binding) => hit.check === binding.address),
    )
  ) {
    return pieceInvalid({
      piece: request.piece,
      detail: "the piece emitted a hit for a binding outside its selected bindings",
    });
  }
  return { outcome: "ok", value: request.hits };
};

const finishFile = (request: {
  readonly active: ActiveFilePiece;
}): Outcome<readonly PieceHit[]> => {
  if (request.active.completion.kind === "complete") {
    return attributedHits({ piece: request.active.piece, hits: request.active.completion.hits });
  }
  try {
    const parsed = pieceHitsSchema.safeParse(request.active.completion.observers.finish());
    if (!parsed.success)
      return pieceInvalid({ piece: request.active.piece, detail: parsed.error.message });
    return attributedHits({ piece: request.active.piece, hits: parsed.data });
  } catch (thrown) {
    return pieceInvalid({ piece: request.active.piece, detail: thrownDetail({ thrown }) });
  }
};

const completedFile = (request: {
  readonly file: WalkerFile;
  readonly active: readonly ActiveFilePiece[];
  readonly inapplicable: readonly CheckAddressText[];
  readonly nativeExceptions: readonly WalkerDirectiveException[];
}): ObserveWalkerFileResult => {
  const finished = collect({ outcomes: request.active.map((active) => finishFile({ active })) });
  if (finished.outcome === "failed") return finished;
  return {
    outcome: "ok",
    value: {
      hits: finished.value.flatMap((hits) =>
        hits.map((hit) => ({ ...hit, file: request.file.file })),
      ),
      nativeExceptions: request.nativeExceptions,
      ...(request.inapplicable.length === 0 ? {} : { inapplicable: request.inapplicable }),
      applicable: request.active.flatMap((active) =>
        active.piece.bindings.map((binding) => binding.address),
      ),
    },
  };
};

const syntaxChecksOf = (request: {
  readonly active: readonly ActiveFilePiece[];
}): readonly CheckAddressText[] =>
  request.active.flatMap((active) =>
    active.completion.kind === "syntax"
      ? active.piece.bindings.map((binding) => binding.address)
      : [],
  );

const classifyPreparedPieces = (pieces: readonly FilePiece[]) => {
  const grouped = Map.groupBy(pieces, ({ check }) =>
    check.kind === "skipped" ? "inapplicable" : "applicable",
  );
  return {
    applicable: grouped.get("applicable") ?? [],
    inapplicable: (grouped.get("inapplicable") ?? []).flatMap(({ piece }) =>
      piece.bindings.map(({ address }) => address),
    ),
  };
};

export const observeWalkerFile = (request: ObserveWalkerFileRequest): ObserveWalkerFileResult => {
  const cache = cachedFile(request);
  const file = cache.file;
  const prepared = collect({
    outcomes: request.pieces.map((piece) => prepareFile({ piece, file })),
  });
  if (prepared.outcome === "failed") return prepared;
  const readFailure = cache.failure();
  if (readFailure !== undefined) return { outcome: "failed", error: readFailure };
  const { applicable, inapplicable } = classifyPreparedPieces(prepared.value);
  if (!applicable.some((selected) => selected.check.kind === "syntax")) {
    return completedFile({
      file,
      active: applicable.flatMap((selected) =>
        selected.check.kind === "complete"
          ? [{ piece: selected.piece, completion: selected.check }]
          : [],
      ),
      nativeExceptions: [],
      inapplicable,
    });
  }
  const parsed = parsedSource({ file, parse: request.parse });
  if (parsed.outcome === "failed") return parsed;
  const active = collect({
    outcomes: applicable.map((selected) => beginFile({ selected, tree: parsed.value })),
  });
  if (active.outcome === "failed") return active;
  const observed = observeSource({
    tree: parsed.value,
    file,
    parse: request.parse,
    sources: active.value.flatMap((selected) =>
      selected.completion.kind === "syntax"
        ? [{ piece: selected.piece, observers: selected.completion.observers }]
        : [],
    ),
  });
  if (observed.outcome === "failed") return observed;
  return completedFile({
    file,
    active: active.value,
    inapplicable,
    nativeExceptions: directiveEscapesIn({
      sourceFile: parsed.value,
      syntaxApi: request.parse.syntaxApi,
      file: file.file,
      comments: observed.value,
      escapes: escapesOf({
        escapes: request.escapes,
        checks: syntaxChecksOf({ active: active.value }),
      }),
      anchorAt: ({ position }) => anchorAt({ tree: parsed.value, position }),
    }),
  });
};

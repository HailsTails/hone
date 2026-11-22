import type { StructuralExceptionEntry } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionEntry } from "../../domain/records/discipline-exceptions/exception-record.ts";
import type { Result } from "../../domain/result.ts";

export type WritableEntry = ExceptionEntry | StructuralExceptionEntry;

type ListBounds = { readonly key: number; readonly open: number; readonly close: number };

type EntrySpan = { readonly start: number; readonly end: number };

type ListShape = { readonly bounds: ListBounds; readonly entries: readonly EntrySpan[] };

type Scan = {
  readonly depth: number;
  readonly quoting: "outside" | "inside" | "escaping";
  readonly stringStart: number;
  readonly lastTopString: { readonly text: string; readonly start: number } | undefined;
  readonly lastSignificant: string;
  readonly opened: { readonly key: number; readonly open: number } | undefined;
  readonly bounds: ListBounds | undefined;
  readonly entryStart: number;
  readonly entries: readonly EntrySpan[];
};

type EntryPiece = EntrySpan & {
  readonly index: number;
  readonly before: string;
  readonly text: string;
};

const EXCEPTIONS_KEY = "exceptions";

const TOP_LEVEL = 1;

const INDENT_STEP = "  ";

const OPENERS = new Set(["{", "["]);

const CLOSERS = new Set(["}", "]"]);

const WHITESPACE = /\s/;

const LINE_START_INDENT = /^[ \t]*/;

const STARTING_SCAN: Scan = {
  depth: 0,
  quoting: "outside",
  stringStart: 0,
  lastTopString: undefined,
  lastSignificant: "",
  opened: undefined,
  bounds: undefined,
  entryStart: 0,
  entries: [],
};

const ENTRY_DEPTH = TOP_LEVEL + 1;

const quotedScan = (request: {
  readonly scan: Scan;
  readonly character: string;
  readonly position: number;
  readonly text: string;
}): Scan => {
  const { scan, character } = request;
  if (scan.quoting === "escaping") {
    return { ...scan, quoting: "inside" };
  }
  if (character === "\\") {
    return { ...scan, quoting: "escaping" };
  }
  if (character !== '"') {
    return scan;
  }
  const lastTopString =
    scan.depth === TOP_LEVEL
      ? {
          text: request.text.slice(scan.stringStart + 1, request.position),
          start: scan.stringStart,
        }
      : scan.lastTopString;
  return { ...scan, quoting: "outside", lastTopString, lastSignificant: character };
};

const listOpening = (request: { readonly scan: Scan; readonly position: number }): Scan["opened"] =>
  request.scan.depth === TOP_LEVEL &&
  request.scan.lastSignificant === ":" &&
  request.scan.lastTopString?.text === EXCEPTIONS_KEY
    ? { key: request.scan.lastTopString.start, open: request.position }
    : request.scan.opened;

const closedBounds = (request: {
  readonly scan: Scan;
  readonly position: number;
}): Scan["bounds"] =>
  request.scan.depth === TOP_LEVEL + 1 &&
  request.scan.opened !== undefined &&
  request.scan.bounds === undefined
    ? { ...request.scan.opened, close: request.position }
    : request.scan.bounds;

const listStanding = (request: { readonly scan: Scan }): "in-list" | "outside-list" =>
  request.scan.opened !== undefined && request.scan.bounds === undefined
    ? "in-list"
    : "outside-list";

const entryOpening = (request: { readonly scan: Scan; readonly position: number }): number =>
  listStanding(request) === "in-list" && request.scan.depth === ENTRY_DEPTH
    ? request.position
    : request.scan.entryStart;

const closedEntries = (request: {
  readonly scan: Scan;
  readonly position: number;
}): readonly EntrySpan[] =>
  listStanding(request) === "in-list" && request.scan.depth === ENTRY_DEPTH + 1
    ? [...request.scan.entries, { start: request.scan.entryStart, end: request.position }]
    : request.scan.entries;

const structuralScan = (request: {
  readonly scan: Scan;
  readonly character: string;
  readonly position: number;
}): Scan => {
  const { scan, character, position } = request;
  if (character === '"') {
    return { ...scan, quoting: "inside", stringStart: position };
  }
  if (OPENERS.has(character)) {
    const opened = character === "[" ? listOpening({ scan, position }) : scan.opened;
    return {
      ...scan,
      depth: scan.depth + 1,
      opened,
      entryStart: entryOpening({ scan, position }),
      lastSignificant: character,
    };
  }
  if (CLOSERS.has(character)) {
    return {
      ...scan,
      depth: scan.depth - 1,
      bounds: closedBounds({ scan, position }),
      entries: closedEntries({ scan, position }),
      lastSignificant: character,
    };
  }
  return WHITESPACE.test(character) ? scan : { ...scan, lastSignificant: character };
};

const listShapeIn = (request: { readonly text: string }): ListShape | undefined => {
  const scan = request.text
    .split("")
    .map((character, position) => ({ character, position }))
    .reduce(
      (sofar, placed) =>
        sofar.quoting === "outside"
          ? structuralScan({ scan: sofar, ...placed })
          : quotedScan({ scan: sofar, ...placed, text: request.text }),
      STARTING_SCAN,
    );
  return scan.bounds === undefined ? undefined : { bounds: scan.bounds, entries: scan.entries };
};

const renderedEntries = (request: {
  readonly entries: readonly WritableEntry[];
  readonly indent: string;
  readonly lineBreak: string;
}): string =>
  request.entries
    .map((entry) =>
      JSON.stringify(entry, null, INDENT_STEP.length)
        .split("\n")
        .map((line) => `${request.indent}${line}`)
        .join(request.lineBreak),
    )
    .join(`,${request.lineBreak}`);

const lastContentBefore = (request: {
  readonly text: string;
  readonly bounds: ListBounds;
}): number =>
  request.text.slice(request.bounds.open + 1, request.bounds.close).trimEnd().length +
  request.bounds.open;

const appendedText = (request: {
  readonly text: string;
  readonly bounds: ListBounds;
  readonly entries: readonly WritableEntry[];
}): string => {
  const { text, bounds } = request;
  const lineBreak = text.includes("\r\n") ? "\r\n" : "\n";
  const keyIndent =
    LINE_START_INDENT.exec(text.slice(0, bounds.key).split("\n").at(-1) ?? "")?.[0] ?? "";
  const rendered = renderedEntries({
    entries: request.entries,
    indent: `${keyIndent}${INDENT_STEP}`,
    lineBreak,
  });
  const lastContent = lastContentBefore({ text, bounds });
  return lastContent === bounds.open
    ? `${text.slice(0, bounds.open + 1)}${lineBreak}${rendered}${lineBreak}${keyIndent}${text.slice(bounds.close)}`
    : `${text.slice(0, lastContent + 1)},${lineBreak}${rendered}${text.slice(lastContent + 1)}`;
};

export const exceptionsTextWith = (request: {
  readonly text: string | undefined;
  readonly entries: readonly WritableEntry[];
}): Result<string, { readonly detail: string }> => {
  if (request.text === undefined) {
    return {
      outcome: "ok",
      value: `${JSON.stringify({ version: 1, exceptions: request.entries }, null, INDENT_STEP.length)}\n`,
    };
  }
  if (request.entries.length === 0) {
    return { outcome: "ok", value: request.text };
  }
  const shape = listShapeIn({ text: request.text });
  return shape === undefined
    ? {
        outcome: "failed",
        error: { detail: "holds no top-level exceptions list to add records to" },
      }
    : {
        outcome: "ok",
        value: appendedText({ text: request.text, bounds: shape.bounds, entries: request.entries }),
      };
};

const entryPiecesOf = (request: {
  readonly text: string;
  readonly shape: ListShape;
}): readonly EntryPiece[] => {
  const { open } = request.shape.bounds;
  const previousEnds = [open, ...request.shape.entries.map((span) => span.end)];
  return request.shape.entries.map((span, index) => ({
    ...span,
    index,
    before: request.text.slice((previousEnds[index] ?? open) + 1, span.start),
    text: request.text.slice(span.start, span.end + 1),
  }));
};

const textWithoutPieces = (request: {
  readonly text: string;
  readonly bounds: ListBounds;
  readonly pieces: readonly EntryPiece[];
  readonly removing: ReadonlySet<number>;
}): string => {
  const { text, bounds } = request;
  const opening = text.slice(0, bounds.open + 1);
  const closing = text.slice(bounds.close);
  const [lead] = request.pieces;
  const last = request.pieces.at(-1);
  const [first, ...rest] = request.pieces.filter((piece) => !request.removing.has(piece.index));
  if (lead === undefined || last === undefined || first === undefined) {
    return `${opening}${closing}`;
  }
  const following = rest.map((piece) => `${piece.before}${piece.text}`).join("");
  return `${opening}${lead.before}${first.text}${following}${text.slice(last.end + 1, bounds.close)}${closing}`;
};

export const exceptionsTextWithout = (request: {
  readonly text: string;
  readonly indexes: readonly number[];
}): Result<string, { readonly detail: string }> => {
  if (request.indexes.length === 0) {
    return { outcome: "ok", value: request.text };
  }
  const shape = listShapeIn({ text: request.text });
  if (shape === undefined) {
    return {
      outcome: "failed",
      error: { detail: "holds no top-level exceptions list to remove records from" },
    };
  }
  const missing = request.indexes.find((index) => index >= shape.entries.length);
  if (missing !== undefined) {
    return { outcome: "failed", error: { detail: `holds no exceptions[${missing}] to remove` } };
  }
  const pieces = entryPiecesOf({ text: request.text, shape });
  return {
    outcome: "ok",
    value: textWithoutPieces({
      text: request.text,
      bounds: shape.bounds,
      pieces,
      removing: new Set(request.indexes),
    }),
  };
};

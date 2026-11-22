import type { Result } from "../../../domain/result.ts";
import { parsedJson } from "../parsed-json.ts";

export type ItemText = { readonly title: string; readonly facts: unknown; readonly prose: string };

type OpenFence = { readonly language: string; readonly lines: readonly string[] };

type Fence = OpenFence & { readonly closedAt: number };

type Scan = { readonly open: OpenFence | undefined; readonly closed: readonly Fence[] };

const TITLE_LINE = /^# (?<title>\S.*)$/;

const FENCE_LINE = /^```(?<language>[A-Za-z0-9_-]*)\s*$/;

const FACTS_LANGUAGE = "json";

const LINE_BREAK = /\r?\n/;

type NumberedLine = { readonly line: string; readonly index: number };

const scanned = (scan: Scan, numbered: NumberedLine): Scan => {
  const fence = FENCE_LINE.exec(numbered.line);
  if (scan.open === undefined) {
    return fence === null ? scan : { open: { language: fence.groups?.language ?? "", lines: [] }, closed: scan.closed };
  }
  return fence === null
    ? { open: { language: scan.open.language, lines: [...scan.open.lines, numbered.line] }, closed: scan.closed }
    : { open: undefined, closed: [...scan.closed, { ...scan.open, closedAt: numbered.index }] };
};

const titleOf = (request: { readonly lines: readonly string[] }): Result<string, string> => {
  const first = request.lines.find((line) => line.trim().length > 0);
  const title = first === undefined ? undefined : TITLE_LINE.exec(first)?.groups?.title;
  return title === undefined ? { outcome: "failed", error: "does not start with a title line, # <title>" } : { outcome: "ok", value: title.trim() };
};

const factsFenceOf = (request: { readonly lines: readonly string[] }): Result<Fence, string> => {
  const scan = request.lines.map((line, index): NumberedLine => ({ line, index })).reduce<Scan>(scanned, { open: undefined, closed: [] });
  if (scan.open !== undefined) {
    return { outcome: "failed", error: "has a fenced block that is never closed" };
  }
  const [only, ...others] = scan.closed.filter((fence) => fence.language === FACTS_LANGUAGE);
  if (only === undefined) {
    return { outcome: "failed", error: "holds no fenced json block of facts" };
  }
  return others.length > 0 ? { outcome: "failed", error: "holds more than one fenced json block; the facts are one block" } : { outcome: "ok", value: only };
};

export const itemTextOf = (request: { readonly text: string }): Result<ItemText, string> => {
  const lines = request.text.split(LINE_BREAK);
  const title = titleOf({ lines });
  if (title.outcome === "failed") {
    return title;
  }
  const fence = factsFenceOf({ lines });
  if (fence.outcome === "failed") {
    return fence;
  }
  const facts = parsedJson({ text: fence.value.lines.join("\n") });
  const prose = lines.slice(fence.value.closedAt + 1).join("\n").trim();
  return facts.outcome === "failed"
    ? { outcome: "failed", error: `has facts that are not JSON: ${facts.error}` }
    : { outcome: "ok", value: { title: title.value, facts: facts.value, prose } };
};

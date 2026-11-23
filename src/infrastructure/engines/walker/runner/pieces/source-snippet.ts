const MAX_LENGTH = 80;

const trimSnippet = (text: string, ellipsis: "over-limit" | "at-limit" = "over-limit"): string =>
  text.length > MAX_LENGTH || (ellipsis === "at-limit" && text.length === MAX_LENGTH)
    ? `${text.slice(0, MAX_LENGTH)}…`
    : text;

export const sourceSnippetOf = (text: string): string =>
  trimSnippet(text.replace(/\r?\n[ \t]*/g, " "));

export const compactSourceSnippetOf = (text: string): string =>
  trimSnippet(text.replace(/\s+/g, " "));

export const sourceSnippetAt = ({
  source,
  position,
}: {
  readonly source: string;
  readonly position: number;
}): string =>
  trimSnippet(source.slice(position, position + MAX_LENGTH).replace(/\n/g, " "), "at-limit");

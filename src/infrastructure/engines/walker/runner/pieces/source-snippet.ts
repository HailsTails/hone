const MAX_LENGTH = 80;

const trimSnippet = (text: string): string =>
  text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text;

export const sourceSnippetOf = (text: string): string =>
  trimSnippet(text.replace(/\r?\n[ \t]*/g, " "));

export const compactSourceSnippetOf = (text: string): string =>
  trimSnippet(text.replace(/\s+/g, " "));

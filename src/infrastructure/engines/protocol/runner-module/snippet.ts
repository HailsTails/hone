import { z } from "zod";

export const SNIPPET_LIMIT = 200;

export const CUT_MARK = "…";

const cutToLimit = (request: { readonly characters: readonly string[] }): string =>
  `${request.characters.slice(0, SNIPPET_LIMIT).join("")}${CUT_MARK}`;

export const snippetSchema = z.string().transform((text) => {
  const characters = Array.from(text);
  return characters.length > SNIPPET_LIMIT ? cutToLimit({ characters }) : text;
});

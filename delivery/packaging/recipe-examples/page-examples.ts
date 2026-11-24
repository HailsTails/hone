import { anchorOf } from "../catalogue-pages/catalogue-page.ts";

export type PageExample = {
  readonly anchor: string;
  readonly before: string | undefined;
  readonly after: readonly string[];
};

const EXAMPLES_HEADING = /^## Examples\n/m;

const NEXT_PART_HEADING = /^## /m;

const EXAMPLE_HEADING = /^### /m;

const TYPESCRIPT_BLOCK = /^```ts\n([\s\S]*?)^```$/gm;

const readPart = (request: { readonly text: string }): string =>
  request.text.split(EXAMPLES_HEADING)[1]?.split(NEXT_PART_HEADING)[0] ?? "";

const mapChunkToExample = (request: { readonly chunk: string }): PageExample => {
  const title = request.chunk.slice(0, request.chunk.indexOf("\n")).trim();
  const [before, ...after] = [...request.chunk.matchAll(TYPESCRIPT_BLOCK)].flatMap(
    ([, source]) => source ?? [],
  );
  return { anchor: anchorOf({ title }), before, after };
};

export const mapPageToExamples = (request: { readonly text: string }): readonly PageExample[] =>
  readPart({ text: request.text.replaceAll("\r\n", "\n") })
    .split(EXAMPLE_HEADING)
    .slice(1)
    .map((chunk) => mapChunkToExample({ chunk }));

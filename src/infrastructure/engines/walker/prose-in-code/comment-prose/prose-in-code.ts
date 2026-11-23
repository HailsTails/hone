import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;
const TRACKED_TODO = /^TODO\((?:#[1-9]\d*|[a-z][\w-]*-[1-9]\d*|https?:\/\/\S+)\)(?:\s|$)/i;
const TOOL_DIRECTIVE =
  /^(?:(?:@ts-(?:check|nocheck|ignore|expect-error)|@jsx(?:Frag|ImportSource|Runtime)?|biome-ignore(?:-all|-start|-end)?|(?:eslint|oxlint)-(?:disable(?:-line|-next-line)?|enable)|prettier-ignore(?:-start|-end)?|(?:istanbul|v8|c8) ignore)\b|eslint\s+[\w@/.-]+\s*:)/;
const TYPESCRIPT_REFERENCE =
  /^\/\/\/\s*<(?:reference\s+(?:path|types|lib|no-default-lib)|amd-(?:module|dependency)\s+name)\b/;

const commentContent = (text: string): string =>
  text
    .replace(/^\/(?:\/+|\*+)/, "")
    .replace(/\*\/$/, "")
    .trim();

export const check: WalkerPiece = {
  prepare: ({ bindings }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (!TYPESCRIPT_FILE.test(file) || folderScope({ file }) === "generated") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                comment: ({ range }) => {
                  const comment = sourceFile.text.slice(range.pos, range.end);
                  const content = commentContent(comment);
                  if (
                    TRACKED_TODO.test(content) ||
                    TOOL_DIRECTIVE.test(content) ||
                    TYPESCRIPT_REFERENCE.test(comment)
                  )
                    return;
                  const anchor = anchorAt({ position: range.pos });
                  const snippet = comment.replace(/\r?\n/g, " ");
                  hits.push(
                    ...bindings.map(({ address }) => ({ check: address, anchor, snippet })),
                  );
                },
                finish: () => hits,
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};

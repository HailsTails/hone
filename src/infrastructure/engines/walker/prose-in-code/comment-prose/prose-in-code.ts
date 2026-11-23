import { folderScope } from "../../runner/pieces/source-scope.ts";
import { sourceSnippetOf } from "../../runner/pieces/source-snippet.ts";
import {
  type TrackedCheck,
  numberedReferenceKind,
  trackedChecksOf,
  trackingReference,
} from "../../runner/pieces/tracker-patterns.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;
const TODO = /^TODO(?=\()/i;
const URL_REFERENCE = /^\(https?:\/\/[^()\s]+\)$/i;
const TOOL_DIRECTIVE =
  /^(?:(?:@ts-(?:check|nocheck|ignore|expect-error)|@jsx(?:Frag|ImportSource|Runtime)?|biome-ignore(?:-all|-start|-end)?|(?:eslint|oxlint)-(?:disable(?:-line|-next-line)?|enable)|prettier-ignore(?:-start|-end)?|(?:istanbul|v8|c8) ignore)\b|eslint\s+[\w@/.-]+\s*:|!\s*(?:@license|@preserve)(?=\s|$))/;
const TOOL_ANNOTATION =
  /^(?:[@#]__PURE__|!\s*license\s+[\w.+-]+|eslint-env\s+[\w-]+(?:\s*,\s*[\w-]+)*|@vitest-environment\s+\S+|webpackChunkName\s*:\s*(?:"[^"]+"|'[^']+'))$/;
const VITEST_OPTIONS = /^@vitest-environment-options\s+(?<settings>\{[\s\S]*\})$/;
const TYPESCRIPT_REFERENCE =
  /^\/\/\/\s*<(?:reference\s+(?:path|types|lib|no-default-lib)|amd-(?:module|dependency)\s+name)\b/;

const commentContent = (text: string): string =>
  text
    .replace(/^\/(?:\/+|\*+)/, "")
    .replace(/\*\/$/, "")
    .trim();

const vitestOptionsKind = (text: string): "options" | "other" => {
  const json = VITEST_OPTIONS.exec(text)?.groups?.settings;
  if (json === undefined) return "other";
  try {
    JSON.parse(json);
    return "options";
  } catch {
    return "other";
  }
};

const reportingChecksOf = (request: {
  readonly comment: string;
  readonly checks: readonly TrackedCheck[];
}): readonly TrackedCheck[] => {
  const { comment, checks } = request;
  const content = commentContent(comment);
  if (
    TOOL_DIRECTIVE.test(content) ||
    TOOL_ANNOTATION.test(content) ||
    vitestOptionsKind(content) === "options" ||
    TYPESCRIPT_REFERENCE.test(comment)
  )
    return [];
  const todo = TODO.exec(content);
  const reference = todo === null ? "" : content.slice(todo[0].length);
  if (numberedReferenceKind(reference) === "other" && !URL_REFERENCE.test(reference)) return checks;
  return checks.filter((tracked) => trackingReference({ tracked, reference }) === "untracked");
};

export const check: WalkerPiece = {
  prepare: ({ bindings }) => {
    const configured = trackedChecksOf({ bindings });
    if (configured.outcome === "failed") return configured;
    return {
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
                    const reporting = reportingChecksOf({ comment, checks: configured.value });
                    if (reporting.length === 0) return;
                    const anchor = anchorAt({ position: range.pos });
                    const snippet = sourceSnippetOf(comment);
                    hits.push(
                      ...reporting.map(({ binding }) => ({
                        check: binding.address,
                        anchor,
                        snippet,
                      })),
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
    };
  },
};

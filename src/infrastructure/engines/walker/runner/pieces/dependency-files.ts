import type { Result } from "../../../../../domain/result.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import { createDefaultJsoncParsePort } from "./jsonc-parse.ts";
import { folderScope } from "./source-scope.ts";
import type { WalkerFile } from "./walker-piece.ts";

type Field = readonly [string, unknown];

export const fieldsOf = (value: unknown): readonly Field[] =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? Object.entries(value) : [];

export const PACKAGE_MANIFEST = /(?:^|\/)package\.json$/;
export const WORKFLOW =
  /^(?:\.github\/workflows\/.*\.ya?ml|\.gitlab-ci\.ya?ml|azure-pipelines\.ya?ml)$/;

type ReadFile<Content> = Result<Content | undefined, PieceFailure>;

export const dependencySourceOf = (
  request: WalkerFile & {
    readonly accepts: RegExp;
  },
): ReadFile<string> =>
  request.accepts.test(request.file) && folderScope({ file: request.file }) !== "generated"
    ? request.readText()
    : { outcome: "ok", value: undefined };

const jsonc = createDefaultJsoncParsePort({ trailingCommas: "refused" });

export const packageManifestOf = (file: WalkerFile): ReadFile<ReadonlyMap<string, unknown>> => {
  const text = dependencySourceOf({ ...file, accepts: PACKAGE_MANIFEST });
  if (text.outcome === "failed") return text;
  if (text.value === undefined) return { outcome: "ok", value: undefined };
  const parsed = jsonc.parse({ source: text.value });
  return parsed.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "file-unparseable", file: file.file, detail: parsed.error.detail },
      }
    : { outcome: "ok", value: new Map(fieldsOf(parsed.value)) };
};

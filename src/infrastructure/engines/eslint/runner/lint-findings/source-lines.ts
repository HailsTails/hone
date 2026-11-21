import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import type { FileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RuleHit } from "./lint-hits.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

export type LinesReader = (request: { readonly file: RepoPath }) => Outcome<readonly string[]>;

const LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/;

export const linesReaderOf =
  (request: { readonly fileText: FileTextPort; readonly path: PathPort; readonly repoRoot: AbsolutePath }): LinesReader =>
  ({ file }) => {
    const text = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, file] }) });
    if (text.outcome === "failed") {
      return { outcome: "failed", error: { kind: "file-unreadable", file, detail: text.error.detail } };
    }
    return { outcome: "ok", value: text.value.split(LINE_BREAK) };
  };

export const sourceLinesFor = (request: {
  readonly file: RepoPath;
  readonly ruleHits: readonly RuleHit[];
  readonly readLines: LinesReader;
}): Outcome<readonly string[]> =>
  request.ruleHits.length === 0 ? { outcome: "ok", value: [] } : request.readLines({ file: request.file });

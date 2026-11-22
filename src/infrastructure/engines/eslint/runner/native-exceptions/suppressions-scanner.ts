import { z } from "zod";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { NativeException } from "../../../../../domain/runner/runner-result-types.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { parsedJson } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import { suppressionsFileSchema } from "./eslint-file-schemas.ts";
import { repoPathResolved, type SelectedRule } from "./package-script-scanner.ts";

const REPO_ROOT = "repo-root";

const ruleExceptions = (request: {
  readonly ruleIds: readonly string[];
  readonly file: RepoPath;
  readonly location: RepoPath;
  readonly selectedRules: readonly SelectedRule[];
}): readonly NativeException[] =>
  request.ruleIds.flatMap((ruleId) =>
    request.selectedRules
      .filter((rule) => rule.ruleId === ruleId)
      .map(
        (rule): NativeException => ({
          kind: "suppression-entry",
          clause: rule.clause,
          file: request.file,
          location: request.location,
        }),
      ),
  );

const appendedEntry = (request: {
  readonly entries: Result<readonly NativeException[], RunnerFailure>;
  readonly key: string;
  readonly ruleIds: readonly string[];
  readonly baseSegments: readonly string[];
  readonly location: RepoPath;
  readonly selectedRules: readonly SelectedRule[];
}): Result<readonly NativeException[], RunnerFailure> => {
  if (request.entries.outcome === "failed") {
    return request.entries;
  }
  const file = repoPathResolved({ baseSegments: request.baseSegments, path: request.key });
  if (file.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: `${request.location}: key ${request.key} names no file inside the repository`,
      },
    };
  }
  return {
    outcome: "ok",
    value: [
      ...request.entries.value,
      ...ruleExceptions({
        ruleIds: request.ruleIds,
        file: file.value,
        location: request.location,
        selectedRules: request.selectedRules,
      }),
    ],
  };
};

const baseSegmentsOf = (request: { readonly keysRelativeTo: RepoPath | "repo-root" }): readonly string[] =>
  request.keysRelativeTo === REPO_ROOT ? [] : request.keysRelativeTo.split("/");

export type SuppressionsFile = z.infer<typeof suppressionsFileSchema>;

export type SuppressionsReader = (request: { readonly location: RepoPath }) => Result<SuppressionsFile, RunnerFailure>;

export const suppressionsFileOf = (request: {
  readonly location: RepoPath;
  readonly text: string;
}): Result<SuppressionsFile, RunnerFailure> => {
  const json = parsedJson({ text: request.text });
  if (json.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: `${request.location}: ${json.error}` },
    };
  }
  const suppressions = suppressionsFileSchema.safeParse(json.value);
  if (!suppressions.success) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: `${request.location}: ${z.prettifyError(suppressions.error)}` },
    };
  }
  return { outcome: "ok", value: suppressions.data };
};

export const suppressionEntriesIn = (request: {
  readonly location: RepoPath;
  readonly keysRelativeTo: RepoPath | "repo-root";
  readonly suppressions: SuppressionsFile;
  readonly selectedRules: readonly SelectedRule[];
}): Result<readonly NativeException[], RunnerFailure> => {
  const baseSegments = baseSegmentsOf({ keysRelativeTo: request.keysRelativeTo });
  return Object.entries(request.suppressions).reduce<Result<readonly NativeException[], RunnerFailure>>(
    (entries, [key, rules]) =>
      appendedEntry({
        entries,
        key,
        ruleIds: Object.keys(rules),
        baseSegments,
        location: request.location,
        selectedRules: request.selectedRules,
      }),
    { outcome: "ok", value: [] },
  );
};

export const suppressionEntriesOf = (request: {
  readonly location: RepoPath;
  readonly keysRelativeTo: RepoPath | "repo-root";
  readonly text: string;
  readonly selectedRules: readonly SelectedRule[];
}): Result<readonly NativeException[], RunnerFailure> => {
  const suppressions = suppressionsFileOf(request);
  return suppressions.outcome === "failed"
    ? suppressions
    : suppressionEntriesIn({ ...request, suppressions: suppressions.value });
};

export const suppressionsReaderOf =
  (request: { readonly fileText: FileTextPort; readonly path: PathPort; readonly repoRoot: AbsolutePath }): SuppressionsReader =>
  ({ location }) => {
    const text = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, location] }) });
    if (text.outcome === "failed") {
      return { outcome: "failed", error: { kind: "file-unreadable", file: location, detail: text.error.detail } };
    }
    return suppressionsFileOf({ location, text: text.value });
  };

export const scriptSuppressionEntries = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly location: RepoPath;
  readonly keysRelativeTo: RepoPath | "repo-root";
  readonly selectedRules: readonly SelectedRule[];
}): Result<readonly NativeException[], RunnerFailure> => {
  const suppressions = suppressionsReaderOf(request)({ location: request.location });
  return suppressions.outcome === "failed"
    ? suppressions
    : suppressionEntriesIn({ ...request, suppressions: suppressions.value });
};

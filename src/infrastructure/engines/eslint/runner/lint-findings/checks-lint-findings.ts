import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import type {
  CheckHit,
  CheckMeasurement,
  CheckNativeException,
} from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { MeasuredPair } from "../../../../../domain/runner/runner-result-types.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import type {
  MisnamedRuleId,
  SelectedNamedCheck,
  VersionOneRuleId,
} from "../checks-runner/checks-run-types.ts";
import type { LintedFile } from "../toolchain/eslint-instance.ts";
import { namedHitsCutFrom, namedMessageReadingOf } from "./lint-hits.ts";
import { misnamedRuleIdsIn } from "./misnamed-rule-ids.ts";
import { type LinesReader, sourceLinesFor } from "./source-lines.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

type FileRequest = {
  readonly linted: LintedFile;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly sourceLines: LinesReader;
  readonly selected: readonly SelectedNamedCheck[];
  readonly checkRuleIds: readonly string[];
  readonly versionOneRuleIds: readonly VersionOneRuleId[];
};

const outsideRepository = (request: { readonly linted: LintedFile }): Outcome<RepoPath> => ({
  outcome: "failed",
  error: {
    kind: "tool-failed",
    detail: `ESLint linted ${request.linted.filePath}, which is outside the repository`,
  },
});

const lintedRepoPath = (
  request: Pick<FileRequest, "linted" | "path" | "repoRoot">,
): Outcome<RepoPath> => {
  const location = request.path.relative({ from: request.repoRoot, to: request.linted.filePath });
  if (location.relation === "different-root") {
    return outsideRepository(request);
  }
  const file = repoPathSchema.safeParse(location.path);
  return file.success ? { outcome: "ok", value: file.data } : outsideRepository(request);
};

export const parseableFile = (
  request: Pick<FileRequest, "linted" | "path" | "repoRoot">,
): Outcome<RepoPath> => {
  const file = lintedRepoPath(request);
  if (file.outcome === "failed") {
    return file;
  }
  const fatal = request.linted.messages.find((message) => message.fatal === true);
  return fatal === undefined
    ? file
    : {
        outcome: "failed",
        error: { kind: "file-unparseable", file: file.value, detail: fatal.message },
      };
};

export const measuredOn = (request: {
  readonly file: RepoPath;
  readonly linted: LintedFile;
  readonly clauses: readonly ClauseAddress[];
}): readonly MeasuredPair[] => {
  if (request.linted.messages.some((message) => message.ruleId === null)) {
    return [];
  }
  const distinct = new Map(request.clauses.map((clause) => [JSON.stringify(clause), clause]));
  return [...distinct.values()].map((clause) => ({ clause, file: request.file }));
};

type NamedFileFindings = {
  readonly hits: readonly CheckHit[];
  readonly nativeExceptions: readonly CheckNativeException[];
  readonly measured: readonly CheckMeasurement[];
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
};

export const namedLintedFindingsOf = (request: FileRequest): Outcome<NamedFileFindings> => {
  const parsed = parseableFile(request);
  if (parsed.outcome === "failed") return parsed;
  const file = parsed.value;
  const messages = request.linted.messages;
  const selected = request.selected.map(({ address, ruleId }) => ({ ruleId, check: address }));
  const read = gatheredOutcomes({
    outcomes: selected.map((rule) =>
      listedOutcome({ outcome: namedMessageReadingOf({ file, messages, selected: [rule] }) }),
    ),
  });
  if (read.outcome === "failed") return read;
  const ruleHits = read.value.flatMap((observed) => observed.ruleHits);
  const lines = sourceLinesFor({ file, ruleHits, readLines: request.sourceLines });
  if (lines.outcome === "failed") return lines;
  const checked = messages.some(({ ruleId }) => ruleId === null)
    ? []
    : [...new Set(selected.map(({ check }) => check))];
  return {
    outcome: "ok",
    value: {
      hits: namedHitsCutFrom({ file, ruleHits, lines: lines.value }),
      nativeExceptions: read.value.flatMap((observed) => observed.nativeExceptions),
      measured: checked.map((check) => ({ check, file })),
      misnamedRuleIds: misnamedRuleIdsIn({
        file,
        messages,
        checkRuleIds: request.checkRuleIds,
        versionOneRuleIds: request.versionOneRuleIds,
      }),
    },
  };
};

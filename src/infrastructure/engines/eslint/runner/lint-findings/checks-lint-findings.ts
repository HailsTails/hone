import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { Hit, MeasuredPair, NativeException } from "../../../../../domain/runner/runner-result-types.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { MisnamedRuleId, SelectedCheck, VersionOneRuleId } from "../checks-runner/checks-run-types.ts";
import type { LintedFile } from "../toolchain/eslint-instance.ts";
import { hitsCutFrom, messageReadingOf } from "./lint-hits.ts";
import { misnamedRuleIdsIn } from "./misnamed-rule-ids.ts";
import { type LinesReader, sourceLinesFor } from "./source-lines.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

type FileFindings = {
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly measured: readonly MeasuredPair[];
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
};

type FileRequest = {
  readonly linted: LintedFile;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly sourceLines: LinesReader;
  readonly selected: readonly SelectedCheck[];
  readonly checkRuleIds: readonly string[];
  readonly versionOneRuleIds: readonly VersionOneRuleId[];
};

const outsideRepository = (request: { readonly linted: LintedFile }): Outcome<RepoPath> => ({
  outcome: "failed",
  error: { kind: "tool-failed", detail: `ESLint linted ${request.linted.filePath}, which is outside the repository` },
});

const lintedRepoPath = (request: Pick<FileRequest, "linted" | "path" | "repoRoot">): Outcome<RepoPath> => {
  const location = request.path.relative({ from: request.repoRoot, to: request.linted.filePath });
  if (location.relation === "different-root") {
    return outsideRepository(request);
  }
  const file = repoPathSchema.safeParse(location.path);
  return file.success ? { outcome: "ok", value: file.data } : outsideRepository(request);
};

export const parseableFile = (request: Pick<FileRequest, "linted" | "path" | "repoRoot">): Outcome<RepoPath> => {
  const file = lintedRepoPath(request);
  if (file.outcome === "failed") {
    return file;
  }
  const fatal = request.linted.messages.find((message) => message.fatal === true);
  return fatal === undefined ? file : { outcome: "failed", error: { kind: "file-unparseable", file: file.value, detail: fatal.message } };
};

export const measuredOn = (request: { readonly file: RepoPath; readonly linted: LintedFile; readonly clauses: readonly ClauseAddress[] }): readonly MeasuredPair[] => {
  if (request.linted.messages.some((message) => message.ruleId === null)) {
    return [];
  }
  const distinct = new Map(request.clauses.map((clause) => [JSON.stringify(clause), clause]));
  return [...distinct.values()].map((clause) => ({ clause, file: request.file }));
};

const checkFindingsOf = (request: FileRequest & { readonly file: RepoPath; readonly entry: SelectedCheck }): Outcome<Omit<FileFindings, "measured" | "misnamedRuleIds">> => {
  const { entry } = request;
  const reading = messageReadingOf({ file: request.file, messages: request.linted.messages, selected: [{ ruleId: entry.ruleId, clause: { address: entry.clause } }] });
  if (reading.outcome === "failed") {
    return reading;
  }
  const lines = sourceLinesFor({ file: request.file, ruleHits: reading.value.ruleHits, readLines: request.sourceLines });
  return lines.outcome === "failed"
    ? lines
    : {
        outcome: "ok",
        value: {
          hits: hitsCutFrom({ file: request.file, ruleHits: reading.value.ruleHits, lines: lines.value }).map((hit) => ({ ...hit, check: entry.address })),
          nativeExceptions: reading.value.nativeExceptions.map((exception) => ({ ...exception, check: entry.address })),
        },
      };
};

export const lintedFindingsOf = (request: FileRequest): Outcome<FileFindings> => {
  const file = parseableFile(request);
  if (file.outcome === "failed") {
    return file;
  }
  const perCheck = gatheredOutcomes({
    outcomes: request.selected.map((entry) => listedOutcome({ outcome: checkFindingsOf({ ...request, file: file.value, entry }) })),
  });
  return perCheck.outcome === "failed"
    ? perCheck
    : {
        outcome: "ok",
        value: {
          hits: perCheck.value.flatMap((found) => found.hits),
          nativeExceptions: perCheck.value.flatMap((found) => found.nativeExceptions),
          measured: measuredOn({ file: file.value, linted: request.linted, clauses: request.selected.map((entry) => entry.clause) }),
          misnamedRuleIds: misnamedRuleIdsIn({
            file: file.value,
            messages: request.linted.messages,
            checkRuleIds: request.checkRuleIds,
            versionOneRuleIds: request.versionOneRuleIds,
          }),
        },
      };
};

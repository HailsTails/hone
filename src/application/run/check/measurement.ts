import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import type { ExceptionEntryParser } from "../../ports/records/exception-entries.ts";
import { type ExceptionBaseline, UNMEASURED_EXCEPTION_BASELINE } from "../../../domain/records/discipline-exceptions/exception-baseline.ts";
import { legacyChainsIn, recordImportOf, type StructuralExceptionEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { GitFailure } from "../../../domain/repository/git-failure.ts";
import { baseRevisionAvailabilityOf, computeTouchedSet } from "../touched-set/touched-set.ts";
import type { TouchedSet } from "../../../domain/repository/touched-set.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Assessment } from "../../../domain/settings/assessment.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { whyChainFormOf } from "../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import type { PartialAssessment, Unmeasured } from "../../../domain/report/check-report.ts";

export type ChangeSetReach = {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
};

export type BaselineReach = {
  readonly repoRoot: AbsolutePath;
  readonly git: Pick<GitPort, "textInBase" | "renamedSince">;
  readonly exceptionRepository: Pick<ExceptionRepository, "readAt">;
};

export type ChangeSetNeed = { readonly kind: "settled"; readonly touched: TouchedSet } | { readonly kind: "measure-since-base" };

export type BaselineNeed =
  | { readonly kind: "settled"; readonly baseline: ExceptionBaseline }
  | { readonly kind: "read-at-base"; readonly baseRevision: string; readonly sources: readonly RepoPath[] };

const forfeitureUnmeasured = (request: {
  readonly touched: TouchedSet;
  readonly records: readonly ExceptionRecord[];
}): readonly Unmeasured[] =>
  request.touched.measured === "no" && request.records.some((record) => record.kind === "file-carve-out")
    ? [{ kind: "forfeiture-unmeasured", base: request.touched.base }]
    : [];

const fileCarveOutsIn = (request: { readonly records: readonly ExceptionRecord[] }): number =>
  request.records.filter((record) => record.kind === "file-carve-out").length;

export const changeSetNeedOf = (request: {
  readonly assessment: Assessment;
  readonly records: readonly ExceptionRecord[];
}): ChangeSetNeed => {
  if (request.assessment.forfeiture === "elsewhere") {
    return { kind: "settled", touched: { measured: "elsewhere" } };
  }
  return fileCarveOutsIn(request) > 0
    ? { kind: "measure-since-base" }
    : { kind: "settled", touched: { measured: "yes", paths: new Set() } };
};

export const touchedSetFor = (request: {
  readonly check: ChangeSetReach & { readonly assessment: Assessment };
  readonly records: readonly ExceptionRecord[];
}): TouchedSet => {
  const need = changeSetNeedOf({ assessment: request.check.assessment, records: request.records });
  return need.kind === "settled" ? need.touched : computeTouchedSet(request.check);
};

export const partialAssessmentsOf = (request: {
  readonly assessment: Assessment;
  readonly records: readonly ExceptionRecord[];
}): readonly PartialAssessment[] =>
  request.assessment.forfeiture === "elsewhere"
    ? [{ concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: fileCarveOutsIn(request) }]
    : [];

const importedRecords = (request: { readonly records: readonly ExceptionRecord[] }): "present" | "absent" =>
  request.records.some((record) => recordImportOf({ record }).imported === "yes")
    ? "present"
    : "absent";

const legacyChainRecords = (request: { readonly records: readonly ExceptionRecord[] }): "present" | "absent" =>
  request.records.some((record) => whyChainFormOf({ chain: record.whyChain }) === "legacy")
    ? "present"
    : "absent";

const legacyChainUnmeasured = (request: {
  readonly exceptionBaseline: ExceptionBaseline;
  readonly records: readonly ExceptionRecord[];
}): readonly Unmeasured[] =>
  request.exceptionBaseline.measured === "no" && legacyChainRecords({ records: request.records }) === "present"
    ? [{ kind: "legacy-chain-unmeasured", base: request.exceptionBaseline.base }]
    : [];

const importUnmeasured = (request: {
  readonly exceptionBaseline: ExceptionBaseline;
  readonly records: readonly ExceptionRecord[];
}): readonly Unmeasured[] =>
  request.exceptionBaseline.measured === "no" && importedRecords({ records: request.records }) === "present"
    ? [{ kind: "import-unmeasured", base: request.exceptionBaseline.base }]
    : [];

export const unmeasuredOf = (request: {
  readonly touched: TouchedSet;
  readonly exceptionBaseline: ExceptionBaseline;
  readonly records: readonly ExceptionRecord[];
}): readonly Unmeasured[] => [
  ...forfeitureUnmeasured(request),
  ...importUnmeasured(request),
  ...legacyChainUnmeasured(request),
];

const textsInBase = (request: {
  readonly reach: BaselineReach;
  readonly baseRevision: string;
  readonly files: readonly RepoPath[];
}): Result<ReadonlyMap<RepoPath, string>, GitFailure> => {
  const readings = request.files.map((file) => ({
    file,
    reading: request.reach.git.textInBase({ repoRoot: request.reach.repoRoot, baseRevision: request.baseRevision, file }),
  }));
  const failed = readings.find(({ reading }) => reading.outcome === "failed");
  if (failed !== undefined && failed.reading.outcome === "failed") {
    return failed.reading;
  }
  return {
    outcome: "ok",
    value: new Map(
      readings.flatMap(({ file, reading }): readonly (readonly [RepoPath, string])[] =>
        reading.outcome === "ok" && reading.value.presence === "present-in-base" ? [[file, reading.value.text]] : [],
      ),
    ),
  };
};

export type ImportedEntriesReader = Pick<ExceptionEntryParser, "importedEntriesIn" | "importSourcesOf">;

export const baselineNeedOf = (request: {
  readonly baseRevision: string | undefined;
  readonly entries: readonly StructuralExceptionEntry[];
  readonly exceptionEntryParser: ImportedEntriesReader;
}): BaselineNeed => {
  const { baseRevision, entries, exceptionEntryParser } = request;
  if (baseRevision === undefined || (exceptionEntryParser.importedEntriesIn({ entries }) === "absent" && legacyChainsIn({ entries }) === "absent")) {
    return { kind: "settled", baseline: UNMEASURED_EXCEPTION_BASELINE };
  }
  return { kind: "read-at-base", baseRevision, sources: exceptionEntryParser.importSourcesOf({ entries }) };
};

export const baselineAtBase = (request: {
  readonly reach: BaselineReach;
  readonly baseRevision: string;
  readonly sources: readonly RepoPath[];
}): ExceptionBaseline => {
  const { baseRevision } = request;
  const entriesAtBase = request.reach.exceptionRepository.readAt({ revision: baseRevision });
  if (entriesAtBase.outcome === "failed") {
    return { measured: "no", base: baseRevisionAvailabilityOf({ revision: baseRevision, failure: entriesAtBase.error }) };
  }
  const texts = textsInBase({ reach: request.reach, baseRevision, files: request.sources });
  if (texts.outcome === "failed") {
    return { measured: "no", base: baseRevisionAvailabilityOf({ revision: baseRevision, failure: texts.error }) };
  }
  const renames = request.reach.git.renamedSince({ repoRoot: request.reach.repoRoot, baseRevision });
  if (renames.outcome === "failed") {
    return { measured: "no", base: baseRevisionAvailabilityOf({ revision: baseRevision, failure: renames.error }) };
  }
  return { measured: "yes", entriesAtBase: entriesAtBase.value, sourceTextsAtBase: texts.value, basePathOfRenamed: renames.value };
};

export const exceptionBaselineOf = (request: {
  readonly check: BaselineReach & { readonly baseRevision: string | undefined; readonly exceptionEntryParser: ImportedEntriesReader };
  readonly entries: readonly StructuralExceptionEntry[];
}): ExceptionBaseline => {
  const { baseRevision, exceptionEntryParser } = request.check;
  const need = baselineNeedOf({ baseRevision, entries: request.entries, exceptionEntryParser });
  return need.kind === "settled"
    ? need.baseline
    : baselineAtBase({ reach: request.check, baseRevision: need.baseRevision, sources: need.sources });
};

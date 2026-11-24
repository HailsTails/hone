import { failureDetailOf } from "../../../domain/failure-detail.ts";
import { runVerdictOf } from "../../../domain/report/report-sections.ts";
import { verdictOf } from "../../../domain/report/verdict.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type {
  AfterWriting,
  ProofCarriedOver,
  ProofRefusal,
  Smoothed,
  Unrestored,
} from "../../ports/upgrade/proof-outcome.ts";
import type { ProofCheck, ProofRunFailure, ProofRuns } from "../../ports/upgrade/proof-runs.ts";
import type { RecordAnswerOracle } from "../../ports/upgrade/record-answer-oracle.ts";
import type { SmoothingCommands } from "../../ports/upgrade/smoothing-commands.ts";
import type {
  VersionOneFiles,
  VersionOneReading,
} from "../../ports/upgrade/version-one-reading.ts";
import {
  patchedProjectionsOf,
  restoredOriginalProjections,
} from "../patching/projection-patching.ts";
import {
  type PlannedFile,
  type ProofQueries,
  type ProofWrites,
  rolledBackWrites,
  writtenProofFiles,
} from "../proof-writes/proof-writes.ts";
import {
  type RecordsRoot,
  filesStillPresentOf,
  projectionDeclarationsOf,
  recordsOutsideRoot,
  removedVersionOneFiles,
  type VersionOneRemoval,
} from "../proof-writes/version-one-removal.ts";
import { runSmoothing, type SmoothingState } from "../smoothing/upgrade-smoothing.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";
import { replacementsOf } from "./projection-replacements.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";
import { type ProjectionFilesOf, type UpgradePlan, upgradePlanOf } from "./upgrade-plan.ts";
import type {
  ProjectionsRefusal,
  VersionOneProjectionsOf,
  VersionOneProjectionsReading,
} from "./version-one-projections-reading.ts";

export type UpgradeProofRequest = {
  readonly queries: ProofQueries;
  readonly effects: ProofEffects;
  readonly oracle: RecordAnswerOracle;
  readonly runs: ProofRuns;
  readonly smoothing: SmoothingCommands;
  readonly reading: VersionOneReading;
  readonly versionOneFiles: VersionOneFiles;
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
  readonly projectionFilesOf: ProjectionFilesOf;
  readonly settingsFormat: Pick<SettingsFileFormat, "textOf">;
  readonly versionOneProjectionsOf: VersionOneProjectionsOf;
  readonly ruleSetLayout: RuleSetLayoutRemoval;
};

export type RuleSetLayoutRemoval = {
  readonly removed: readonly RepoPath[];
  readonly folders: readonly RepoPath[];
};

export type PlacedRepoFile = PlannedFile & { readonly file: RepoPath };

type Placed = {
  readonly files: readonly PlacedRepoFile[];
  readonly replacements: readonly PlannedFile[];
  readonly replaced: readonly RepoPath[];
  readonly removal: VersionOneRemoval;
};

const unplaceable = (request: { readonly file: RepoPath }): ProofRefusal => ({
  kind: "unplaceable-path",
  file: request.file,
  removedByVersionOne: [],
});

const absoluteOf = (request: {
  readonly queries: ProofQueries;
  readonly repoRoot: AbsolutePath;
  readonly file: RepoPath;
}): Result<AbsolutePath, ProofRefusal> => {
  const joined = request.queries.path.join({ segments: [request.repoRoot, request.file] });
  return isAbsolutePath(joined)
    ? { outcome: "ok", value: joined }
    : { outcome: "failed", error: unplaceable({ file: request.file }) };
};

const plannedFileOf = (request: {
  readonly queries: ProofQueries;
  readonly repoRoot: AbsolutePath;
  readonly planned: PlannedRepoFile;
}): Result<PlacedRepoFile, ProofRefusal> => {
  const path = absoluteOf({ ...request, file: request.planned.file });
  return path.outcome === "ok"
    ? {
        outcome: "ok",
        value: { file: request.planned.file, path: path.value, text: request.planned.text },
      }
    : path;
};

const allOf = <Value>(request: {
  readonly results: readonly Result<Value, ProofRefusal>[];
}): Result<readonly Value[], ProofRefusal> => {
  const failed = request.results.find((settled) => settled.outcome === "failed");
  return (
    failed ?? {
      outcome: "ok",
      value: request.results.flatMap((settled) =>
        settled.outcome === "ok" ? [settled.value] : [],
      ),
    }
  );
};

export const placedFilesOf = (request: {
  readonly queries: ProofQueries;
  readonly repoRoot: AbsolutePath;
  readonly files: readonly PlannedRepoFile[];
}): Result<readonly PlacedRepoFile[], ProofRefusal> =>
  allOf({
    results: request.files.map((planned) =>
      plannedFileOf({ queries: request.queries, repoRoot: request.repoRoot, planned }),
    ),
  });

const absolutesOf = (request: {
  readonly queries: ProofQueries;
  readonly repoRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
}): Result<readonly AbsolutePath[], ProofRefusal> =>
  allOf({
    results: request.files.map((file) =>
      absoluteOf({ queries: request.queries, repoRoot: request.repoRoot, file }),
    ),
  });

const recordsRootOf = (request: UpgradeProofRequest): Result<RecordsRoot, ProofRefusal> => {
  const { queries, repoRoot, versionOneFiles } = request;
  if (versionOneFiles.recordsRoot.kind === "repository") {
    return { outcome: "ok", value: { kind: "repository", path: repoRoot } };
  }
  const folder = absoluteOf({ queries, repoRoot, file: versionOneFiles.recordsRoot.folder });
  return folder.outcome === "ok"
    ? { outcome: "ok", value: { kind: "folder", path: folder.value } }
    : folder;
};

const removalOf = (
  request: UpgradeProofRequest & {
    readonly projections: readonly VersionOneProjection[];
    readonly removed: readonly AbsolutePath[];
  },
): Result<VersionOneRemoval, ProofRefusal> => {
  const { queries, repoRoot, versionOneFiles, ruleSetLayout } = request;
  const recordsFiles = absolutesOf({ queries, repoRoot, files: versionOneFiles.recordsFiles });
  const recordsFolders = absolutesOf({ queries, repoRoot, files: versionOneFiles.recordsFolders });
  const ruleSetFiles = absolutesOf({ queries, repoRoot, files: ruleSetLayout.removed });
  const ruleSetFolders = absolutesOf({ queries, repoRoot, files: ruleSetLayout.folders });
  const recordsRoot = recordsRootOf(request);
  const projections = allOf({
    results: request.projections.map(({ projection }) =>
      absoluteOf({ queries, repoRoot, file: projection }),
    ),
  });
  const settings = absoluteOf({ queries, repoRoot, file: versionOneFiles.settings });
  if (recordsFiles.outcome === "failed") return recordsFiles;
  if (recordsFolders.outcome === "failed") return recordsFolders;
  if (ruleSetFiles.outcome === "failed") return ruleSetFiles;
  if (ruleSetFolders.outcome === "failed") return ruleSetFolders;
  if (recordsRoot.outcome === "failed") return recordsRoot;
  if (projections.outcome === "failed") return projections;
  if (settings.outcome === "failed") return settings;
  return {
    outcome: "ok",
    value: {
      recordsFiles: recordsFiles.value,
      recordsFolders: recordsFolders.value,
      recordsRoot: recordsRoot.value,
      projections: projections.value,
      declarations: projectionDeclarationsOf({
        projections: [...projections.value, ...request.removed],
        fileText: queries.fileText,
      }),
      settings: settings.value,
      ruleSetFiles: ruleSetFiles.value,
      ruleSetFolders: ruleSetFolders.value,
    },
  };
};

type ToPlace = UpgradeProofRequest & {
  readonly plan: UpgradePlan;
  readonly projections: readonly VersionOneProjection[];
  readonly removed: readonly AbsolutePath[];
  readonly replacements: readonly PlannedRepoFile[];
};

const placedOf = (request: ToPlace): Result<Placed, ProofRefusal> => {
  const { queries, repoRoot, plan } = request;
  const files = placedFilesOf({ queries, repoRoot, files: plan.files });
  const replacements = placedFilesOf({ queries, repoRoot, files: request.replacements });
  const removal = removalOf(request);
  if (files.outcome === "failed") return files;
  if (replacements.outcome === "failed") return replacements;
  if (removal.outcome === "failed") return removal;
  return {
    outcome: "ok",
    value: {
      files: files.value,
      replacements: replacements.value,
      replaced: request.replacements.map(({ file }) => file),
      removal: removal.value,
    },
  };
};

const removedPlacedOf = (request: {
  readonly queries: ProofQueries;
  readonly repoRoot: AbsolutePath;
  readonly removed: readonly RepoPath[];
}): Result<readonly AbsolutePath[], ProofRefusal> =>
  absolutesOf({ queries: request.queries, repoRoot: request.repoRoot, files: request.removed });

const projectionsRefusalOf = (request: { readonly refusal: ProjectionsRefusal }): ProofRefusal => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "project-failed":
      return {
        kind: "version-one-project-failed",
        detail: refusal.detail,
        removedByVersionOne: [],
      };
    case "project-rewrote":
      return { kind: "version-one-project-rewrote", files: refusal.files, removedByVersionOne: [] };
    case "team-config-refused":
    case "slice-left-in-place":
      return { kind: "plan-refused", refusal, removedByVersionOne: [] };
  }
};

type Written = {
  readonly plan: UpgradePlan;
  readonly placed: Placed;
  readonly writes: ProofWrites;
  readonly removed: readonly AbsolutePath[];
};

type CheckPasses = {
  readonly check: "passes";
  readonly written: readonly RepoPath[];
  readonly smoothed: Smoothed;
};

const refusedWith = (request: {
  readonly effects: ProofEffects;
  readonly writes: ProofWrites;
  readonly refusal: (unrestored: readonly Unrestored[]) => ProofRefusal;
}): Result<never, ProofRefusal> => ({
  outcome: "failed",
  error: request.refusal(rolledBackWrites({ effects: request.effects, writes: request.writes })),
});

const checkedReport = async (
  request: UpgradeProofRequest & { readonly state: SmoothingState },
): Promise<Result<ProofCheck, ProofRunFailure>> => {
  try {
    return await request.runs.versionTwo({ written: request.state.written });
  } catch (thrown: unknown) {
    return {
      outcome: "failed",
      error: { kind: "run-failed", detail: failureDetailOf({ thrown }) },
    };
  }
};

const checkedAfterSmoothing = async (
  request: UpgradeProofRequest & { readonly state: SmoothingState },
): Promise<Result<CheckPasses, ProofRefusal>> => {
  const { effects, state } = request;
  const checked = await checkedReport(request);
  if (checked.outcome === "failed") {
    return refusedWith({
      effects,
      writes: state.writes,
      refusal: (unrestored) => ({
        kind: "version-two-run-failed",
        failure: checked.error,
        unrestored,
        removedByVersionOne: [],
      }),
    });
  }
  const { report, failing } = checked.value;
  if (report.misnamed.length > 0) {
    return refusedWith({
      effects,
      writes: state.writes,
      refusal: (unrestored) => ({
        kind: "directives-name-no-check",
        directives: report.misnamed,
        unrestored,
        removedByVersionOne: [],
      }),
    });
  }
  return runVerdictOf({ report }) === "fail"
    ? refusedWith({
        effects,
        writes: state.writes,
        refusal: (unrestored) => ({
          kind: "check-failed",
          failing,
          unrestored,
          removedByVersionOne: [],
        }),
      })
    : {
        outcome: "ok",
        value: { check: "passes", written: state.written, smoothed: state.smoothed },
      };
};

const smoothedAndChecked = async (
  request: UpgradeProofRequest & Written,
): Promise<Result<CheckPasses, ProofRefusal>> => {
  const smoothed = await runSmoothing({
    queries: request.queries,
    effects: request.effects,
    commands: request.smoothing,
    repoRoot: request.repoRoot,
    writes: request.writes,
    written: request.placed.files.map(({ file }) => file),
  });
  return smoothed.outcome === "failed"
    ? smoothed
    : checkedAfterSmoothing({ ...request, state: smoothed.value });
};

const removedAfterPassing = (
  request: UpgradeProofRequest & Written & { readonly passing: CheckPasses },
): Result<ProofCarriedOver, ProofRefusal> => {
  const carried: AfterWriting = {
    written: request.passing.written,
    replaced: request.placed.replaced,
  };
  const removed = removedVersionOneFiles({
    path: request.queries.path,
    effects: request.effects,
    removal: request.placed.removal,
  });
  return removed.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "removal-failed",
          failure: removed.error,
          remaining: filesStillPresentOf({
            removal: request.placed.removal,
            failure: removed.error,
          }),
          ...carried,
        },
      }
    : {
        outcome: "ok",
        value: {
          ...carried,
          removed: { ...removed.value, files: [...request.removed, ...removed.value.files] },
          records: request.plan.lines,
          smoothed: request.passing.smoothed,
        },
      };
};

const writtenAndChecked = async (
  request: UpgradeProofRequest & Omit<Written, "writes">,
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const writes = writtenProofFiles({
    queries: request.queries,
    effects: request.effects,
    files: request.placed.files,
    replacements: request.placed.replacements,
  });
  if (writes.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "write-refused", refusal: writes.error, removedByVersionOne: [] },
    };
  }
  const written: UpgradeProofRequest & Written = { ...request, writes: writes.value };
  const passing = await smoothedAndChecked(written);
  return passing.outcome === "failed"
    ? passing
    : removedAfterPassing({ ...written, passing: passing.value });
};

const afterProjecting = async (
  request: UpgradeProofRequest & {
    readonly plan: UpgradePlan;
    readonly projections: readonly VersionOneProjection[];
    readonly removed: readonly AbsolutePath[];
  },
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const replacements = replacementsOf({
    projections: request.projections,
    projected: request.plan.projected,
  });
  if (replacements.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "plan-refused", refusal: replacements.error, removedByVersionOne: [] },
    };
  }
  const placed = placedOf({ ...request, replacements: replacements.value });
  if (placed.outcome === "failed") {
    return placed;
  }
  const outside = recordsOutsideRoot({ path: request.queries.path, removal: placed.value.removal });
  if (outside !== undefined) {
    return {
      outcome: "failed",
      error: { kind: "removal-refused", failure: outside, removedByVersionOne: [] },
    };
  }
  return writtenAndChecked({ ...request, placed: placed.value });
};

const withRemovedByVersionOne = <Value>(request: {
  readonly result: Result<Value, ProofRefusal>;
  readonly removed: readonly RepoPath[];
}): Result<Value, ProofRefusal> => {
  if (request.result.outcome === "ok") {
    return request.result;
  }
  const { error } = request.result;
  return error.kind === "oracle-failed" || error.kind === "removal-failed"
    ? request.result
    : { outcome: "failed", error: { ...error, removedByVersionOne: request.removed } };
};

const projectedOver = async (
  request: UpgradeProofRequest & { readonly plan: UpgradePlan },
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const reading = await request.versionOneProjectionsOf();
  const carried = await afterReading({ ...request, projectionsReading: reading });
  return withRemovedByVersionOne({ result: carried, removed: reading.removed });
};

const afterReading = async (
  request: UpgradeProofRequest & {
    readonly plan: UpgradePlan;
    readonly projectionsReading: VersionOneProjectionsReading;
  },
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const reading = request.projectionsReading;
  const removed = removedPlacedOf({
    queries: request.queries,
    repoRoot: request.repoRoot,
    removed: reading.removed,
  });
  if (removed.outcome === "failed") {
    return removed;
  }
  if (reading.outcome.outcome === "failed") {
    return { outcome: "failed", error: projectionsRefusalOf({ refusal: reading.outcome.error }) };
  }
  return afterProjecting({
    ...request,
    projections: reading.outcome.value,
    removed: removed.value,
  });
};

const provenOver = async (
  request: UpgradeProofRequest,
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const before = await request.runs.versionOne();
  if (before.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "version-one-run-failed", failure: before.error, removedByVersionOne: [] },
    };
  }
  if (verdictOf({ report: before.value }) === "fail") {
    return {
      outcome: "failed",
      error: { kind: "version-one-check-fails", removedByVersionOne: [] },
    };
  }
  const answered = await request.oracle.answer({
    records: request.reading.heads.map(({ record }) => record),
  });
  if (answered.outcome === "failed") {
    return { outcome: "failed", error: { kind: "oracle-failed", failure: answered.error } };
  }
  const plan = await upgradePlanOf({
    reading: request.reading,
    answered: answered.value,
    catalogues: request.catalogues,
    projectionFilesOf: request.projectionFilesOf,
    settingsFormat: request.settingsFormat,
  });
  if (plan.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "plan-refused", refusal: plan.error, removedByVersionOne: [] },
    };
  }
  return projectedOver({ ...request, plan: plan.value });
};

export const upgradeProof = async (
  request: UpgradeProofRequest,
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const { queries, effects, repoRoot, trackedPaths } = request;
  const patches = patchedProjectionsOf({ queries, effects, repoRoot, trackedPaths });
  if (patches.outcome === "failed") {
    return patches;
  }
  const proven = await provenOver(request);
  return proven.outcome === "ok"
    ? proven
    : {
        outcome: "failed",
        error: restoredOriginalProjections({
          queries,
          effects,
          repoRoot,
          patches: patches.value,
          refusal: proven.error,
        }),
      };
};

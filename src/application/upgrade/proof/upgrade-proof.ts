import type { MisnamedRuleId } from "../../../domain/runner/checks-run-report.ts";
import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { RecordAnswerOracle, OracleFailure } from "../record-answers/record-answer-oracle.ts";
import { type ProofDifference, proofDifferencesOf } from "../proof-comparison/proof-differences.ts";
import { type PlannedFile, type ProofWriteRefusal, type ProofWritePorts, type ProofWrites, rolledBackProofWrites, type Unrestored, writeProofFiles } from "../proof-writes/proof-writes.ts";
import { type OutsideRoot, type Removed, type RemovalFailure, type RecordsRoot, filesStillPresentOf, recordsOutsideRoot, removedVersionOneFiles, type VersionOneRemoval } from "../proof-writes/version-one-removal.ts";
import type { MarkedNotAdopted } from "../mapping/settings-mapping.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";
import { replacementsOf } from "./projection-replacements.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";
import { type PlanRefusal, type ProjectionFilesOf, type UpgradePlan, upgradePlanOf, type VersionOneReading } from "./upgrade-plan.ts";
import type { ProjectionsRefusal, VersionOneProjectionsOf, VersionOneProjectionsReading } from "./version-one-projections-reading.ts";

export type ProofRunFailure = { readonly kind: "run-failed"; readonly detail: string };

export type ProofRuns = {
  readonly versionOne: () => Promise<Result<CheckReport, ProofRunFailure>>;
  readonly versionTwo: () => Promise<Result<RunReport, ProofRunFailure>>;
};

export type VersionOneRecordsRoot = { readonly kind: "repository" } | { readonly kind: "folder"; readonly folder: RepoPath };

export type VersionOneFiles = {
  readonly recordsFiles: readonly RepoPath[];
  readonly recordsFolders: readonly RepoPath[];
  readonly recordsRoot: VersionOneRecordsRoot;
  readonly settings: RepoPath;
};

export type UpgradeProofRequest = {
  readonly ports: ProofWritePorts;
  readonly oracle: RecordAnswerOracle;
  readonly runs: ProofRuns;
  readonly reading: VersionOneReading;
  readonly versionOneFiles: VersionOneFiles;
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly repoRoot: AbsolutePath;
  readonly projectionFilesOf: ProjectionFilesOf;
  readonly versionOneProjectionsOf: VersionOneProjectionsOf;
};

export type ProofCarriedOver = {
  readonly markedNotAdopted: readonly MarkedNotAdopted[];
  readonly written: readonly RepoPath[];
  readonly replaced: readonly RepoPath[];
  readonly removed: Removed;
};

export type AfterWriting = { readonly written: readonly RepoPath[]; readonly replaced: readonly RepoPath[] };

type AfterVersionOneProject = { readonly removedByVersionOne: readonly RepoPath[] };

export type ProofRefusal =
  | { readonly kind: "oracle-failed"; readonly failure: OracleFailure }
  | ({ readonly kind: "plan-refused"; readonly refusal: PlanRefusal } & AfterVersionOneProject)
  | ({ readonly kind: "version-one-run-failed"; readonly failure: ProofRunFailure } & AfterVersionOneProject)
  | ({ readonly kind: "version-one-uncovered"; readonly clauses: readonly ClauseAddress[] } & AfterVersionOneProject)
  | ({ readonly kind: "version-one-project-failed"; readonly detail: string } & AfterVersionOneProject)
  | ({ readonly kind: "version-one-project-rewrote"; readonly files: readonly RepoPath[] } & AfterVersionOneProject)
  | ({ readonly kind: "unplaceable-path"; readonly file: RepoPath } & AfterVersionOneProject)
  | ({ readonly kind: "removal-refused"; readonly failure: OutsideRoot } & AfterVersionOneProject)
  | ({ readonly kind: "write-refused"; readonly refusal: ProofWriteRefusal } & AfterVersionOneProject)
  | ({ readonly kind: "version-two-run-failed"; readonly failure: ProofRunFailure; readonly unrestored: readonly Unrestored[] } & AfterVersionOneProject)
  | ({ readonly kind: "directives-name-no-check"; readonly directives: readonly MisnamedRuleId[]; readonly unrestored: readonly Unrestored[] } & AfterVersionOneProject)
  | ({ readonly kind: "differences"; readonly differences: readonly ProofDifference[]; readonly unrestored: readonly Unrestored[] } & AfterVersionOneProject)
  | ({ readonly kind: "removal-failed"; readonly failure: RemovalFailure; readonly remaining: readonly AbsolutePath[] } & AfterWriting);

type Placed = {
  readonly files: readonly PlannedFile[];
  readonly replacements: readonly PlannedFile[];
  readonly replaced: readonly RepoPath[];
  readonly removal: VersionOneRemoval;
};

const unplaceable = (request: { readonly file: RepoPath }): ProofRefusal => ({ kind: "unplaceable-path", file: request.file, removedByVersionOne: [] });

const absoluteOf = (request: { readonly ports: ProofWritePorts; readonly repoRoot: AbsolutePath; readonly file: RepoPath }): Result<AbsolutePath, ProofRefusal> => {
  const joined = request.ports.path.join({ segments: [request.repoRoot, request.file] });
  return isAbsolutePath(joined) ? { outcome: "ok", value: joined } : { outcome: "failed", error: unplaceable({ file: request.file }) };
};

const plannedFileOf = (request: { readonly ports: ProofWritePorts; readonly repoRoot: AbsolutePath; readonly planned: PlannedRepoFile }): Result<PlannedFile, ProofRefusal> => {
  const path = absoluteOf({ ...request, file: request.planned.file });
  return path.outcome === "ok" ? { outcome: "ok", value: { path: path.value, text: request.planned.text } } : path;
};

const allOf = <Value>(request: { readonly results: readonly Result<Value, ProofRefusal>[] }): Result<readonly Value[], ProofRefusal> => {
  const failed = request.results.find((settled) => settled.outcome === "failed");
  return failed ?? { outcome: "ok", value: request.results.flatMap((settled) => (settled.outcome === "ok" ? [settled.value] : [])) };
};

const recordsRootOf = (request: UpgradeProofRequest): Result<RecordsRoot, ProofRefusal> => {
  const { ports, repoRoot, versionOneFiles } = request;
  if (versionOneFiles.recordsRoot.kind === "repository") {
    return { outcome: "ok", value: { kind: "repository", path: repoRoot } };
  }
  const folder = absoluteOf({ ports, repoRoot, file: versionOneFiles.recordsRoot.folder });
  return folder.outcome === "ok" ? { outcome: "ok", value: { kind: "folder", path: folder.value } } : folder;
};

const removalOf = (request: UpgradeProofRequest & { readonly projections: readonly VersionOneProjection[] }): Result<VersionOneRemoval, ProofRefusal> => {
  const { ports, repoRoot, versionOneFiles } = request;
  const recordsFiles = allOf({ results: versionOneFiles.recordsFiles.map((file) => absoluteOf({ ports, repoRoot, file })) });
  const recordsFolders = allOf({ results: versionOneFiles.recordsFolders.map((file) => absoluteOf({ ports, repoRoot, file })) });
  const recordsRoot = recordsRootOf(request);
  const projections = allOf({ results: request.projections.map(({ projection }) => absoluteOf({ ports, repoRoot, file: projection })) });
  const settings = absoluteOf({ ports, repoRoot, file: versionOneFiles.settings });
  if (recordsFiles.outcome === "failed") return recordsFiles;
  if (recordsFolders.outcome === "failed") return recordsFolders;
  if (recordsRoot.outcome === "failed") return recordsRoot;
  if (projections.outcome === "failed") return projections;
  if (settings.outcome === "failed") return settings;
  return {
    outcome: "ok",
    value: { recordsFiles: recordsFiles.value, recordsFolders: recordsFolders.value, recordsRoot: recordsRoot.value, projections: projections.value, settings: settings.value },
  };
};

type ToPlace = UpgradeProofRequest & {
  readonly plan: UpgradePlan;
  readonly projections: readonly VersionOneProjection[];
  readonly replacements: readonly PlannedRepoFile[];
};

const placedOf = (request: ToPlace): Result<Placed, ProofRefusal> => {
  const { ports, repoRoot, plan } = request;
  const files = allOf({ results: plan.files.map((planned) => plannedFileOf({ ports, repoRoot, planned })) });
  const replacements = allOf({ results: request.replacements.map((planned) => plannedFileOf({ ports, repoRoot, planned })) });
  const removal = removalOf(request);
  if (files.outcome === "failed") return files;
  if (replacements.outcome === "failed") return replacements;
  if (removal.outcome === "failed") return removal;
  return {
    outcome: "ok",
    value: { files: files.value, replacements: replacements.value, replaced: request.replacements.map(({ file }) => file), removal: removal.value },
  };
};

const removedPlacedOf = (request: {
  readonly ports: ProofWritePorts;
  readonly repoRoot: AbsolutePath;
  readonly removed: readonly RepoPath[];
}): Result<readonly AbsolutePath[], ProofRefusal> =>
  allOf({ results: request.removed.map((file) => absoluteOf({ ports: request.ports, repoRoot: request.repoRoot, file })) });

const projectionsRefusalOf = (request: { readonly refusal: ProjectionsRefusal }): ProofRefusal => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "project-failed":
      return { kind: "version-one-project-failed", detail: refusal.detail, removedByVersionOne: [] };
    case "project-rewrote":
      return { kind: "version-one-project-rewrote", files: refusal.files, removedByVersionOne: [] };
    case "team-config-refused":
    case "slice-left-in-place":
      return { kind: "plan-refused", refusal, removedByVersionOne: [] };
  }
};

type Written = {
  readonly plan: UpgradePlan;
  readonly before: CheckReport;
  readonly placed: Placed;
  readonly writes: ProofWrites;
  readonly removed: readonly AbsolutePath[];
};

const rolledBackWith = (request: UpgradeProofRequest & Written): readonly Unrestored[] => rolledBackProofWrites({ ports: request.ports, writes: request.writes });

const comparedAfterWriting = async (request: UpgradeProofRequest & Written): Promise<Result<null, ProofRefusal>> => {
  const after = await request.runs.versionTwo();
  if (after.outcome === "failed") {
    return { outcome: "failed", error: { kind: "version-two-run-failed", failure: after.error, unrestored: rolledBackWith(request), removedByVersionOne: [] } };
  }
  if (after.value.misnamed.length > 0) {
    return { outcome: "failed", error: { kind: "directives-name-no-check", directives: after.value.misnamed, unrestored: rolledBackWith(request), removedByVersionOne: [] } };
  }
  const differences = proofDifferencesOf({
    before: request.before,
    after: after.value,
    marked: request.plan.markedNotAdopted,
    catalogues: request.catalogues,
  });
  return differences.length > 0
    ? { outcome: "failed", error: { kind: "differences", differences, unrestored: rolledBackWith(request), removedByVersionOne: [] } }
    : { outcome: "ok", value: null };
};

const comparedOrRolledBack = async (request: UpgradeProofRequest & Written): Promise<Result<null, ProofRefusal>> => {
  try {
    return await comparedAfterWriting(request);
  } catch (thrown: unknown) {
    return {
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: failureDetailOf({ thrown }) }, unrestored: rolledBackWith(request), removedByVersionOne: [] },
    };
  }
};

const removedAfterComparing = (request: UpgradeProofRequest & Written): Result<ProofCarriedOver, ProofRefusal> => {
  const carried: AfterWriting = { written: request.plan.files.map(({ file }) => file), replaced: request.placed.replaced };
  const removed = removedVersionOneFiles({ ports: request.ports, removal: request.placed.removal });
  return removed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "removal-failed", failure: removed.error, remaining: filesStillPresentOf({ removal: request.placed.removal, failure: removed.error }), ...carried } }
    : {
        outcome: "ok",
        value: { ...carried, markedNotAdopted: request.plan.markedNotAdopted, removed: { ...removed.value, files: [...request.removed, ...removed.value.files] } },
      };
};

const writtenAndCompared = async (request: UpgradeProofRequest & Omit<Written, "writes">): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const writes = writeProofFiles({ ports: request.ports, files: request.placed.files, replacements: request.placed.replacements });
  if (writes.outcome === "failed") {
    return { outcome: "failed", error: { kind: "write-refused", refusal: writes.error, removedByVersionOne: [] } };
  }
  const written: UpgradeProofRequest & Written = { ...request, writes: writes.value };
  const compared = await comparedOrRolledBack(written);
  return compared.outcome === "failed" ? compared : removedAfterComparing(written);
};

const afterProjecting = async (
  request: UpgradeProofRequest & { readonly plan: UpgradePlan; readonly before: CheckReport; readonly projections: readonly VersionOneProjection[]; readonly removed: readonly AbsolutePath[] },
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const replacements = replacementsOf({ projections: request.projections, projected: request.plan.projected });
  if (replacements.outcome === "failed") {
    return { outcome: "failed", error: { kind: "plan-refused", refusal: replacements.error, removedByVersionOne: [] } };
  }
  const placed = placedOf({ ...request, replacements: replacements.value });
  if (placed.outcome === "failed") {
    return placed;
  }
  const outside = recordsOutsideRoot({ ports: request.ports, removal: placed.value.removal });
  if (outside !== undefined) {
    return { outcome: "failed", error: { kind: "removal-refused", failure: outside, removedByVersionOne: [] } };
  }
  return writtenAndCompared({ ...request, placed: placed.value });
};

const withRemovedByVersionOne = <Value>(request: {
  readonly result: Result<Value, ProofRefusal>;
  readonly removed: readonly RepoPath[];
}): Result<Value, ProofRefusal> => {
  if (request.result.outcome === "ok") {
    return request.result;
  }
  const { error } = request.result;
  return error.kind === "oracle-failed" || error.kind === "removal-failed" ? request.result : { outcome: "failed", error: { ...error, removedByVersionOne: request.removed } };
};

const projectedOver = async (
  request: UpgradeProofRequest & { readonly plan: UpgradePlan; readonly before: CheckReport },
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const reading = await request.versionOneProjectionsOf();
  const carried = await afterReading({ ...request, projectionsReading: reading });
  return withRemovedByVersionOne({ result: carried, removed: reading.removed });
};

const afterReading = async (
  request: UpgradeProofRequest & { readonly plan: UpgradePlan; readonly before: CheckReport; readonly projectionsReading: VersionOneProjectionsReading },
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const reading = request.projectionsReading;
  const removed = removedPlacedOf({ ports: request.ports, repoRoot: request.repoRoot, removed: reading.removed });
  if (removed.outcome === "failed") {
    return removed;
  }
  if (reading.outcome.outcome === "failed") {
    return { outcome: "failed", error: projectionsRefusalOf({ refusal: reading.outcome.error }) };
  }
  return afterProjecting({ ...request, projections: reading.outcome.value, removed: removed.value });
};

export const upgradeProof = async (request: UpgradeProofRequest): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const answered = await request.oracle.answer({ records: request.reading.heads.map(({ record }) => record) });
  if (answered.outcome === "failed") {
    return { outcome: "failed", error: { kind: "oracle-failed", failure: answered.error } };
  }
  const plan = await upgradePlanOf({
    reading: request.reading,
    answered: answered.value,
    catalogues: request.catalogues,
    projectionFilesOf: request.projectionFilesOf,
  });
  if (plan.outcome === "failed") {
    return { outcome: "failed", error: { kind: "plan-refused", refusal: plan.error, removedByVersionOne: [] } };
  }
  const before = await request.runs.versionOne();
  if (before.outcome === "failed") {
    return { outcome: "failed", error: { kind: "version-one-run-failed", failure: before.error, removedByVersionOne: [] } };
  }
  if (before.value.uncovered.length > 0) {
    return { outcome: "failed", error: { kind: "version-one-uncovered", clauses: before.value.uncovered, removedByVersionOne: [] } };
  }
  return projectedOver({ ...request, plan: plan.value, before: before.value });
};

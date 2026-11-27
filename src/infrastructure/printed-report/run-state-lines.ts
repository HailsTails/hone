import type { Engine } from "../../domain/language-layer/symptom-catalogue.ts";
import { RECORDS_FOLDER } from "../../domain/records/hone-records/records-layout.ts";
import type { RecordsUnmeasured } from "../../domain/records/measurement/records-unmeasured.ts";
import type {
  EngineNotRun,
  MissingProjection,
  RunAssessment,
  RunProjectionProblem,
  RunUnmeasured,
} from "../../domain/report/run-report.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { SETTINGS_FILE_NAME } from "../../domain/settings/settings-file.ts";
import type { SettingsNote, UnreadConventionKey } from "../../domain/settings/settings-note.ts";
import { NESTED_CONFIGURATION_ISSUE } from "../command-line/nested-configuration-issue.ts";
import { counted, quoted } from "./printed-text.ts";

export type ProjectCommand = { readonly projectCommand: string };

const PASS_A_BASE = "pass --base-revision with the branch's base, such as origin/main";

const LEAVE_FORFEITURE_ELSEWHERE = `leave forfeiture to another run with "forfeiture": "elsewhere" in ${SETTINGS_FILE_NAME} or --forfeiture elsewhere`;

const GENERATED_CONFIGURATION =
  "or, where a tool such as sku generates the configuration, last in the configuration the tool takes";

type BaseNeeds = {
  readonly unchecked: string;
  readonly nextStep: string;
  readonly gitAttempt: string;
  readonly needs: string;
};

const BASE_NEEDS: Readonly<Record<RecordsUnmeasured["kind"], BaseNeeds>> = {
  "forfeiture-unmeasured": {
    unchecked: "debt cannot be checked for forfeiture",
    nextStep: `${PASS_A_BASE}, or ${LEAVE_FORFEITURE_ELSEWHERE}`,
    gitAttempt: "list the files changed since that revision",
    needs: `Hone needs that revision and the history back to where this branch left it, or ${LEAVE_FORFEITURE_ELSEWHERE}`,
  },
  "import-unmeasured": {
    unchecked: "carried records cannot be checked against it",
    nextStep: `${PASS_A_BASE}, or ${LEAVE_FORFEITURE_ELSEWHERE}`,
    gitAttempt: `read ${RECORDS_FOLDER} at that revision`,
    needs: `Hone needs ${RECORDS_FOLDER} as it was at that revision`,
  },
};

const recordsUnmeasuredLine = (request: { readonly unmeasured: RecordsUnmeasured }): string => {
  const { kind, base } = request.unmeasured;
  const needs = BASE_NEEDS[kind];
  switch (base.state) {
    case "not-given":
      return `${kind} no-base-revision: no --base-revision was given, so ${needs.unchecked}; ${needs.nextStep}`;
    case "git-failed":
      return `${kind} base-git-failed ${quoted({ text: base.revision })}: git could not ${needs.gitAttempt} and said ${quoted({ text: base.gitMessage })}; ${needs.needs}`;
  }
};

const refreshStep = (request: ProjectCommand): string =>
  `run ${request.projectCommand} and commit every file it writes`;

type EngineRequest = ProjectCommand & { readonly problems: readonly RunProjectionProblem[] };

const sliceNote = (request: EngineRequest & { readonly engine: Engine }): string =>
  request.problems.some(
    (problem) => problem.scope === "slice" && problem.engine.name === request.engine.name,
  )
    ? `; the ${request.engine.name} lines under projection-problems name the package slices involved`
    : "";

const nestedNote = (request: ProjectCommand & { readonly folders: readonly RepoPath[] }): string =>
  request.folders.length === 0
    ? ""
    : `; ${request.folders.join(", ")} hold their own ${SETTINGS_FILE_NAME}, and nested Hone configurations are not supported yet (${NESTED_CONFIGURATION_ISSUE}): to govern such a folder from this repository, remove its ${SETTINGS_FILE_NAME} and keep its records here, then run ${request.projectCommand}, which writes its slice`;

const measuredNothingNextStep = (request: EngineRequest & { readonly engine: Engine }): string =>
  request.problems.some((problem) => problem.engine.name === request.engine.name)
    ? `the ${request.engine.name} lines under projection-problems name what to fix`
    : `check that the ${request.engine.name} configuration lints the files under check`;

export const projectionMissingLine = (
  request: ProjectCommand & { readonly unmeasured: MissingProjection },
): string => {
  const { engine } = request.unmeasured;
  return `${request.unmeasured.kind} ${engine.name} missing: ${request.unmeasured.file} is not written; ${refreshStep(request)}`;
};

const engineNotRunLine = (
  request: EngineRequest & { readonly unmeasured: EngineNotRun },
): string => {
  const { unmeasured } = request;
  const { engine } = unmeasured;
  switch (unmeasured.projection) {
    case "missing":
      return projectionMissingLine({ ...request, unmeasured });
    case "measured-nothing":
      return `${unmeasured.kind} ${engine.name} measured-nothing: the ${engine.name} engine measured no file in this run, so the records its checks answer were not judged, neither kept as answering nor removed as stale; ${measuredNothingNextStep({ ...request, engine })}`;
    case "not-included":
      if (engine.name === "oxlint") {
        return `${unmeasured.kind} ${engine.name} not-included: extend ${unmeasured.file} from the Oxlint configuration for the files under check, after any configuration that changes the selected rules`;
      }
      return `${unmeasured.kind} ${engine.name} not-included: the ${engine.name} configuration leaves the projection out of effect for a file under check; spread the default export of ${unmeasured.file}, or of a package's own ${unmeasured.file} in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), ${GENERATED_CONFIGURATION}${sliceNote({ ...request, engine })}${nestedNote({ ...request, folders: unmeasured.nestedConfigurations })}`;
  }
};

export const unmeasuredLine = (
  request: EngineRequest & { readonly unmeasured: RunUnmeasured },
): string => {
  const { unmeasured } = request;
  switch (unmeasured.kind) {
    case "forfeiture-unmeasured":
    case "import-unmeasured":
      return recordsUnmeasuredLine({ unmeasured });
    case "engine-not-run":
      return engineNotRunLine({ ...request, unmeasured });
  }
};

type SliceProblem = Extract<RunProjectionProblem, { readonly scope: "slice" }>;

const folderOf = (request: { readonly slice: RepoPath }): string =>
  request.slice.split("/").slice(0, -1).join("/");

const sliceProblemReason = (
  request: ProjectCommand & { readonly problem: SliceProblem },
): string => {
  const { engine, file } = request.problem;
  const folder = folderOf({ slice: file });
  switch (request.problem.state) {
    case "out-of-date":
      return `that slice differs from what hone project writes now; ${refreshStep(request)}`;
    case "missing":
      return `that slice is not written; ${refreshStep(request)}`;
    case "not-applied":
      return `extend ${file} from the ${engine.name} configuration in ${folder}, after any configuration that changes the selected rules`;
    case "unconfigured":
      return `${folder} has no ${engine.name} configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check`;
  }
};

export const projectionProblemLine = (
  request: ProjectCommand & { readonly problem: RunProjectionProblem },
): string => {
  const { problem } = request;
  switch (problem.scope) {
    case "projection":
      return `${problem.engine.name} ${problem.state}: ${problem.file} differs from what hone project writes now; ${refreshStep(request)}`;
    case "file":
      return `${problem.engine.name} left-over ${problem.file}: hone project no longer writes this file for the selected projection kind; run ${request.projectCommand} to remove it`;
    case "slice":
      return `${problem.engine.name} ${problem.state} ${problem.file}: ${sliceProblemReason({ ...request, problem })}`;
  }
};

export const assessmentLine = (request: { readonly partial: RunAssessment }): string => {
  const { partial } = request;
  switch (partial.concern) {
    case "forfeiture":
      return `forfeiture ${partial.assessedBy}: ${counted({ count: partial.debts, noun: "debt record" })} not checked for forfeiture in this run`;
    case "carried-standing":
      return `carried standing ${partial.assessedBy}: ${counted({ count: partial.carried, noun: "carried record" })} not checked against the base in this run`;
    case "nested-projection":
      return `${partial.engine.name} not-included: the parent projection is out of effect under ${partial.folders.join(", ")}, where this run found local ${SETTINGS_FILE_NAME} files`;
  }
};

const NOTE_KEY_TEXTS: Readonly<Record<UnreadConventionKey, string>> = {
  generated: "generated",
  layers: "layers",
};

export const settingsNoteText = (request: { readonly note: SettingsNote }): string =>
  `${NOTE_KEY_TEXTS[request.note.key]} is declared; no check reads it yet`;

export const settingsNoteLine = (request: { readonly note: SettingsNote }): string =>
  settingsNoteText(request);

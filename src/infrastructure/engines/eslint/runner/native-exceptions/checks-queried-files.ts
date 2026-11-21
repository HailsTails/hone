import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import type { NativeException } from "../../../protocol/runner-module/runner-result-schema.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import { mappedOutcome } from "../checks-outcomes.ts";
import { type AnsweredFile, CHECKS_PROJECTION_PATH } from "../projection/checks-projection.ts";
import { allOffIn, type CheckedFile, enabledEverywhere, type Holding, ignoreExceptionsOf, overrideExceptionsOf, type ProjectionEffect, type RuleTarget } from "./checks-rule-effects.ts";
import type { SelectedCheck } from "../checks-runner/checks-run-types.ts";
import { SETTINGS_FILE_NAME } from "../config-roots/checks-nested-repositories.ts";
import type { ConfigFileSearch, IgnoredState, QueryInstance } from "../toolchain/eslint-instance.ts";
import { brokenConfigVerdict, type GoverningIgnores } from "../config-roots/governing-config.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

export type QueriedFiles = {
  readonly ignored: readonly RepoPath[];
  readonly checked: readonly CheckedFile[];
};

type QueriedFile =
  | { readonly file: RepoPath; readonly ignored: "ignored" }
  | { readonly file: RepoPath; readonly ignored: "checked"; readonly states: CheckedFile["states"] };

export type ConfigLocation = {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly governingIgnoreOf: GoverningIgnores;
  readonly names: { readonly settingsFile: string; readonly projectionFile: string };
};

const VERSION_TWO_NAMES: ConfigLocation["names"] = { settingsFile: SETTINGS_FILE_NAME, projectionFile: CHECKS_PROJECTION_PATH };

const fileRuleStates = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleId: string;
}): Promise<Outcome<CheckedFile["states"]>> =>
  request.query.ruleState({ file: request.file, ruleId: request.ruleId }).then((state) =>
    mappedOutcome({ outcome: state, map: (ruleState) => [{ ruleId: request.ruleId, state: ruleState }] }),
  );

const checkedQueriedFile = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
}): Promise<Outcome<readonly QueriedFile[]>> =>
  Promise.all(
    request.ruleIds.map((ruleId) => fileRuleStates({ query: request.query, file: request.file, ruleId })),
  ).then((outcomes) =>
    mappedOutcome({
      outcome: gatheredOutcomes({ outcomes }),
      map: (states): readonly QueriedFile[] => [{ file: request.file, ignored: "checked", states }],
    }),
  );

const queriedFileOf = (request: {
  readonly ignoredState: Outcome<IgnoredState>;
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
}): Promise<Outcome<readonly QueriedFile[]>> => {
  if (request.ignoredState.outcome === "failed") {
    return Promise.resolve(request.ignoredState);
  }
  if (request.ignoredState.value === "ignored") {
    return Promise.resolve({ outcome: "ok", value: [{ file: request.file, ignored: "ignored" }] });
  }
  return checkedQueriedFile({ query: request.query, file: request.file, ruleIds: request.ruleIds });
};

const FULL_STOP = ".";

const sentenceOf = (request: { readonly text: string }): string =>
  request.text.endsWith(FULL_STOP) ? request.text : `${request.text}${FULL_STOP}`;

const configRepair = (request: { readonly configFile: string; readonly location: ConfigLocation }): string => {
  const folder = request.location.path.repositoryDirectoryOf({ path: request.configFile });
  return folder === "." || folder === ""
    ? "Fix that config."
    : `Fix that config. Only if ${folder} holds nothing Hone should check, add it to exclude in ${request.location.names.settingsFile} instead.`;
};

const foundConfigDetail = (request: {
  readonly file: RepoPath;
  readonly message: string;
  readonly configFile: string;
  readonly location: ConfigLocation;
}): string => {
  const placed = request.location.path.relative({ from: request.location.repoRoot, to: request.configFile });
  return placed.relation === "different-root"
    ? `${request.configFile}, the ESLint config for ${request.file}, failed to load: ${request.message} Fix that config.`
    : `${placed.path}, the ESLint config for ${request.file}, failed to load: ${request.message} ${configRepair({ configFile: placed.path, location: request.location })}`;
};

const unloadableConfigDetail = (request: {
  readonly file: RepoPath;
  readonly detail: string;
  readonly search: ConfigFileSearch;
  readonly location: ConfigLocation;
}): string => {
  const message = sentenceOf({ text: request.detail });
  switch (request.search.kind) {
    case "found":
      return foundConfigDetail({ file: request.file, message, configFile: request.search.path, location: request.location });
    case "none":
      return `no eslint.config.* applies to ${request.file}. Create one at the repository root that spreads ${request.location.names.projectionFile} last, as ADOPTING.md step 4a shows.`;
    case "unknown":
      return `the ESLint config for ${request.file} failed to load: ${message} Fix that config.`;
  }
};

const unloadableConfigFailure = (request: {
  readonly file: RepoPath;
  readonly detail: string;
  readonly search: ConfigFileSearch;
  readonly location: ConfigLocation;
}): Outcome<readonly QueriedFile[]> => ({
  outcome: "failed",
  error: { kind: "team-config-unloadable", detail: unloadableConfigDetail(request) },
});

const IGNORED_BY_GOVERNING_CONFIG = "ignored-by-governing-config";

const searchedQueryFailure = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly location: ConfigLocation;
  readonly detail: string;
  readonly search: ConfigFileSearch;
}): Promise<Outcome<readonly QueriedFile[]>> => {
  if (request.search.kind !== "found") {
    return Promise.resolve(unloadableConfigFailure(request));
  }
  return brokenConfigVerdict({
    lookup: {
      query: request.query,
      governingIgnoreOf: request.location.governingIgnoreOf,
      path: request.location.path,
      repoRoot: request.location.repoRoot,
    },
    brokenConfig: request.search.path,
    file: request.file,
  }).then((verdict): Outcome<readonly QueriedFile[]> =>
    verdict === IGNORED_BY_GOVERNING_CONFIG
      ? { outcome: "ok", value: [{ file: request.file, ignored: "ignored" }] }
      : unloadableConfigFailure(request),
  );
};

const explainedQueryFailure = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly location: ConfigLocation;
  readonly queried: Outcome<readonly QueriedFile[]>;
}): Promise<Outcome<readonly QueriedFile[]>> => {
  const queried = request.queried;
  if (queried.outcome === "ok" || queried.error.kind !== "team-config-unloadable") {
    return Promise.resolve(queried);
  }
  const detail = queried.error.detail;
  return request.query
    .configFileOf({ file: request.file })
    .then((search) => searchedQueryFailure({ query: request.query, file: request.file, location: request.location, detail, search }));
};

const queriedFile = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
  readonly location: ConfigLocation;
}): Promise<Outcome<readonly QueriedFile[]>> =>
  request.query
    .ignoredState({ file: request.file })
    .then((ignoredState) => queriedFileOf({ ...request, ignoredState }))
    .then((queried) => explainedQueryFailure({ query: request.query, file: request.file, location: request.location, queried }));

const checkedFileOf = (request: { readonly entry: QueriedFile }): readonly CheckedFile[] =>
  request.entry.ignored === "checked" ? [{ file: request.entry.file, states: request.entry.states }] : [];

const partitionedFiles = (request: { readonly queried: readonly QueriedFile[] }): QueriedFiles => ({
  ignored: request.queried.filter((entry) => entry.ignored === "ignored").map((entry) => entry.file),
  checked: request.queried.flatMap((entry) => checkedFileOf({ entry })),
});

export const queriedFiles = (request: {
  readonly query: QueryInstance;
  readonly files: readonly RepoPath[];
  readonly ruleIds: readonly string[];
  readonly location: ConfigLocation;
}): Promise<Outcome<QueriedFiles>> =>
  Promise.all(
    request.files.map((file) => queriedFile({ query: request.query, file, ruleIds: request.ruleIds, location: request.location })),
  ).then((outcomes) =>
    mappedOutcome({
      outcome: gatheredOutcomes({ outcomes }),
      map: (queried) => partitionedFiles({ queried }),
    }),
  );

export const queriedFilesOf = (request: {
  readonly query: QueryInstance;
  readonly files: readonly RepoPath[];
  readonly ruleIds: readonly string[];
  readonly location: Omit<ConfigLocation, "names">;
}): Promise<Outcome<QueriedFiles>> => queriedFiles({ ...request, location: { ...request.location, names: VERSION_TWO_NAMES } });

const answeredHolds = (request: { readonly answered: readonly AnsweredFile[]; readonly entry: SelectedCheck; readonly file: RepoPath }): Holding =>
  request.answered.some(
    (answer) => answer.file === request.file && answer.symptom === request.entry.symptom && (answer.check === undefined || `${answer.symptom}#${answer.check}` === request.entry.address),
  )
    ? "holds"
    : "does-not-hold";

const targetOf = (request: { readonly entry: SelectedCheck }): RuleTarget => ({
  ruleId: request.entry.ruleId,
  clause: request.entry.clause,
  check: request.entry.address,
});

const targetsOf = (request: { readonly selected: readonly SelectedCheck[] }): readonly RuleTarget[] => request.selected.map((entry) => targetOf({ entry }));

export const queryExceptionsOf = (request: {
  readonly selected: readonly SelectedCheck[];
  readonly answered: readonly AnsweredFile[];
  readonly queried: QueriedFiles;
}): readonly NativeException[] => [
  ...request.queried.ignored.flatMap((file) => ignoreExceptionsOf({ targets: targetsOf(request), file })),
  ...request.queried.checked.flatMap((checked) =>
    overrideExceptionsOf({
      targets: targetsOf(request),
      checked,
      holding: (target) =>
        request.selected.some((entry) => entry.address === target.check && answeredHolds({ answered: request.answered, entry, file: checked.file }) === "holds") ? "holds" : "does-not-hold",
    }),
  ),
];

const answeredOff = (request: { readonly selected: readonly SelectedCheck[]; readonly answered: readonly AnsweredFile[]; readonly queried: QueriedFiles }): ProjectionEffect =>
  request.queried.checked.every(
    (checked) =>
      allOffIn({
        checked,
        ruleIds: request.selected.filter((entry) => answeredHolds({ answered: request.answered, entry, file: checked.file }) === "holds").map((entry) => entry.ruleId),
      }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";

export const projectionEffectOf = (request: {
  readonly selected: readonly SelectedCheck[];
  readonly answered: readonly AnsweredFile[];
  readonly queried: QueriedFiles;
}): ProjectionEffect =>
  enabledEverywhere({ ruleIds: request.selected.map((entry) => entry.ruleId), checked: request.queried.checked }) === "in-effect" && answeredOff(request) === "in-effect"
    ? "in-effect"
    : "not-in-effect";

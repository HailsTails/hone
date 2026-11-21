import { z } from "zod";
import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import type { StandaloneRunner } from "../../../protocol/runner-module/runner-module-schema.ts";
import type { ProjectedFile } from "../../../protocol/checks/checks-runner-types.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { ChecksRunnerPorts, EslintPlatformPorts } from "./checks-ports.ts";
import { checksRepositoryOver } from "./checks-repository.ts";
import type { ChecksPlugin } from "../hone-plugin/checks-plugin.ts";
import type { ChecksRunFailure, ChecksRunReport, ChecksRunRequest, ChecksProjectionState, SelectedCheck, VersionOneRuleId } from "./checks-run-types.ts";
import { lintedFindingsOf } from "../lint-findings/checks-lint-findings.ts";
import { checksProjectionText, type ProjectedCheck } from "../projection/checks-projection.ts";
import { queriedFilesOf, projectionEffectOf, queryExceptionsOf, type QueriedFiles } from "../native-exceptions/checks-queried-files.ts";
import { nestedVersionTwoFoldersOf, nestedVersionTwoRepositoriesOf, SETTINGS_FILE_NAME } from "../config-roots/checks-nested-repositories.ts";
import { selectedChecksOf } from "./checks-selection.ts";
import { trackedExceptionsOf } from "../native-exceptions/checks-tracked-exceptions.ts";
import { CHECKS_PLUGIN_NAMESPACE, checkRuleIdOf, eslintRuleIdsOf, runsOnEslint } from "../hone-plugin/check-rule-id.ts";
import { type ClauseAddress, sameClauseAddress } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { cachedGoverningIgnores } from "../config-roots/governing-config.ts";
import { coreInstallOf } from "../projection/core-install.ts";
import { MISNAMED_DISABLE_RULE, MISNAMED_DISABLE_RULE_ID, misnamedDisableRule } from "../lint-findings/misnamed-disable-rule.ts";
import { eslintPieceSettingsSchema } from "../pieces/eslint-piece-settings-schema.ts";
import { eslintPluginModuleSchema, type LoadedEslintPlugin } from "../pieces/eslint-plugin-schema.ts";
import { configLookupDeclaring, folderConfigurationOf, teamConfigLookupFor } from "../config-roots/config-lookup.ts";
import type { QueryInstance } from "../toolchain/eslint-instance.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import { answeredWithin, type ChecksSlice, type ChecksSlices, declarationPathOf, slicesOf } from "../config-roots/checks-slices.ts";
import type { ChecksSliceProblem } from "../../../protocol/checks/checks-runner-types.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import type { EslintConfigLookup } from "../../eslint-config-lookup.ts";
import { conformedCases, loadedPieceClauseOf } from "../conformance/eslint-conform.ts";
import { honePluginAt, honePluginFailureText } from "../hone-plugin/hone-plugin.ts";
import { checksPluginImportOf, type ProjectionFailure, projectedChecksOf } from "../projection/projected-checks.ts";
import { type GeneratedProjectionState as GeneratedState, projectionState } from "../projection/projection.ts";
import { type ProjectionStates, projectionStateAt } from "../projection/projection-states.ts";
import { scriptOptionJudge } from "../native-exceptions/script-option-effect.ts";

type Outcome<Value> = Result<Value, ChecksRunFailure>;

export type ChecksRunner = {
  readonly run: (request: ChecksRunRequest) => Promise<Outcome<ChecksRunReport>>;
  readonly conform: StandaloneRunner["conform"];
  readonly project: (request: ChecksRunRequest) => Promise<Outcome<readonly ProjectedFile[]>>;
};

const NO_FINDINGS = { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [] };

const reportAs = (request: { readonly projection: ChecksProjectionState; readonly slices: readonly ChecksSliceProblem[] }): Outcome<ChecksRunReport> => ({
  outcome: "ok",
  value: { ...NO_FINDINGS, projection: request.projection, slices: request.slices },
});

const toolFailed = (request: { readonly detail: string }): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "tool-failed", detail: request.detail },
});

const projectionFailureOf = (request: { readonly failure: ProjectionFailure }): RunnerFailure => {
  const { failure } = request;
  switch (failure.kind) {
    case "piece-invalid":
      return failure;
    case "check-unknown":
      return { kind: "tool-failed", detail: `${failure.address} names no check that runs on ESLint` };
    case "check-outside-rule-set":
      return { kind: "tool-failed", detail: `${failure.address} is not a check of this tool's own rule set` };
  }
};

const replacementRuleIdsOf = (request: { readonly checks: ChecksRunRequest["checks"]; readonly clause: ClauseAddress }): readonly string[] =>
  request.checks
    .filter((check) => sameClauseAddress({ left: check.clause, right: request.clause }) === "same" && runsOnEslint({ check }) === "eslint")
    .map((check) => checkRuleIdOf({ check }));

const versionOneRuleIdsOf = (request: { readonly checks: ChecksRunRequest["checks"]; readonly bindings: ChecksRunRequest["bindings"] }): readonly VersionOneRuleId[] =>
  request.bindings.flatMap((binding) => {
    const settings = eslintPieceSettingsSchema.safeParse(binding.clause.settings);
    return settings.success
      ? [{ ruleId: `${settings.data.pluginNamespace}/${settings.data.rule}`, replacedBy: replacementRuleIdsOf({ checks: request.checks, clause: binding.clause.address }) }]
      : [];
  });

const lookupRequestOf = (request: { readonly run: ChecksRunRequest; readonly platform: EslintPlatformPorts }) => ({
  fileText: request.platform.fileText,
  path: request.platform.path,
  repoRoot: request.run.repoRoot,
  trackedPaths: request.run.trackedPaths,
});

const lookupOf = (request: { readonly run: ChecksRunRequest; readonly platform: EslintPlatformPorts }): EslintConfigLookup =>
  configLookupDeclaring({ ...lookupRequestOf(request), declared: request.run.declaredConfigLookup });

const notReadyOver = (request: { readonly run: ChecksRunRequest }): Outcome<never> | undefined => {
  const nested = nestedVersionTwoRepositoriesOf({ trackedPaths: request.run.trackedPaths, files: request.run.files });
  return nested.length > 0 ? { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: nested } } } : undefined;
};

const slicesOver = (request: { readonly run: ChecksRunRequest; readonly lookup: EslintConfigLookup }): ChecksSlices =>
  slicesOf({
    trackedPaths: request.run.trackedPaths,
    declared: request.run.declaredConfigRoots,
    lookup: request.lookup,
    nestedRepositories: nestedVersionTwoFoldersOf({ trackedPaths: request.run.trackedPaths }),
  });

const queryInstanceOf = (request: {
  readonly run: ChecksRunRequest;
  readonly platform: EslintPlatformPorts;
  readonly ports: ChecksRunnerPorts;
  readonly lookup: EslintConfigLookup;
}): Result<QueryInstance, RunnerFailure> => {
  const lookup = teamConfigLookupFor({ ...lookupRequestOf(request), lookup: request.lookup, settingsFile: SETTINGS_FILE_NAME });
  if (lookup.outcome === "failed") {
    return lookup;
  }
  return {
    outcome: "ok",
    value: request.ports.eslint.createQueryInstance(
      lookup.value.kind === "repository-root" ? { repoRoot: request.run.repoRoot, configFile: lookup.value.configFile } : { repoRoot: request.run.repoRoot },
    ),
  };
};

const loadedPlugin = (request: { readonly plugin: ChecksPlugin; readonly checkRuleIds: readonly string[] }): Result<LoadedEslintPlugin, RunnerFailure> => {
  const loaded = eslintPluginModuleSchema.safeParse({
    default: { ...request.plugin, rules: { ...request.plugin.rules, [MISNAMED_DISABLE_RULE]: misnamedDisableRule({ checkRuleIds: request.checkRuleIds }) } },
  });
  return loaded.success ? { outcome: "ok", value: loaded.data.default } : toolFailed({ detail: `the Hone plugin is not an ESLint plugin: ${z.prettifyError(loaded.error)}` });
};

const builtPlugin = async (request: { readonly run: ChecksRunRequest; readonly checkRuleIds: readonly string[]; readonly ports: ChecksRunnerPorts; readonly platform: EslintPlatformPorts }): Promise<Result<LoadedEslintPlugin, RunnerFailure>> => {
  const plugin = await honePluginAt({
    checks: request.run.checks,
    installRoot: request.run.installRoot,
    fileText: request.platform.fileText,
    path: request.platform.path,
    modules: request.platform.modules,
    boundary: request.ports.eslint.boundary,
  });
  return plugin.outcome === "failed" ? toolFailed({ detail: honePluginFailureText({ failure: plugin.error }) }) : loadedPlugin({ plugin: plugin.value, checkRuleIds: request.checkRuleIds });
};

type SliceRequest = {
  readonly run: ChecksRunRequest;
  readonly projected: readonly ProjectedCheck[];
  readonly ports: ChecksRunnerPorts;
  readonly slices: ChecksSlices;
};

type ExpectedFiles = { readonly root: ProjectedFile; readonly packages: readonly ProjectedFile[]; readonly declarations: readonly ProjectedFile[] };

type ProjectionStatus = { readonly projection: GeneratedState; readonly slices: readonly ChecksSliceProblem[] };

const importingDirectoryOf = (request: { readonly run: ChecksRunRequest; readonly ports: ChecksRunnerPorts; readonly slice: ChecksSlice }): Result<AbsolutePath, RunnerFailure> => {
  const { directory } = request.slice;
  if (directory === undefined) {
    return { outcome: "ok", value: request.run.repoRoot };
  }
  const resolved = request.ports.path.resolve({ path: request.ports.path.join({ segments: [request.run.repoRoot, directory] }) });
  return resolved.outcome === "ok" ? resolved : toolFailed({ detail: `${directory} does not resolve to a folder of ${request.run.repoRoot}` });
};

const expectedSliceOf = (request: Omit<SliceRequest, "slices"> & { readonly slice: ChecksSlice }): Result<ProjectedFile, RunnerFailure> => {
  const install = request.ports.coreInstall({ installRoot: request.run.installRoot });
  if (install.outcome === "failed") {
    return install;
  }
  const importing = importingDirectoryOf(request);
  if (importing.outcome === "failed") {
    return importing;
  }
  const pluginImport = checksPluginImportOf({ path: request.ports.path, importingDirectory: importing.value, installRoot: request.run.installRoot, install: install.value });
  return pluginImport.placement === "importable"
    ? {
        outcome: "ok",
        value: { file: request.slice.file, text: checksProjectionText({ pluginImport: pluginImport.specifier, checks: request.projected, answered: answeredWithin({ answered: request.run.answered, slice: request.slice }) }) },
      }
    : toolFailed({ detail: `the Hone plugin cannot be imported from ${importing.value}` });
};

const expectedDeclarationOf = (request: { readonly slice: ChecksSlice; readonly boundary: EslintMajorBoundary }): ProjectedFile => ({
  file: declarationPathOf(request),
  text: request.boundary.declarationText,
});

const expectedFilesOf = (request: SliceRequest): Result<ExpectedFiles, RunnerFailure> => {
  const root = expectedSliceOf({ ...request, slice: request.slices.root });
  if (root.outcome === "failed") {
    return root;
  }
  const packages = gatheredOutcomes({ outcomes: request.slices.packages.map((slice) => listedOutcome({ outcome: expectedSliceOf({ ...request, slice }) })) });
  return packages.outcome === "failed"
    ? packages
    : {
        outcome: "ok",
        value: {
          root: root.value,
          packages: packages.value,
          declarations: [request.slices.root, ...request.slices.packages].map((slice) => expectedDeclarationOf({ slice, boundary: request.ports.eslint.boundary })),
        },
      };
};

const sliceStateOf = (request: { readonly states: ProjectionStates; readonly expected: ProjectedFile }): Result<GeneratedState, RunnerFailure> => {
  const current = projectionStateAt({ states: request.states, file: request.expected.file });
  return current.outcome === "failed" ? current : { outcome: "ok", value: projectionState({ current: current.value, generated: request.expected.text }) };
};

const packageProblemOf = (request: { readonly states: ProjectionStates; readonly expected: ProjectedFile }): Result<readonly ChecksSliceProblem[], RunnerFailure> => {
  const state = sliceStateOf(request);
  if (state.outcome === "failed") {
    return state;
  }
  return { outcome: "ok", value: state.value === "current" ? [] : [{ slice: request.expected.file, state: state.value }] };
};

const currentProjectionStatus = (request: SliceRequest): Result<ProjectionStatus, RunnerFailure> => {
  const expected = expectedFilesOf(request);
  if (expected.outcome === "failed") {
    return expected;
  }
  const { root, packages, declarations } = expected.value;
  const repository = request.ports.repositoryAt({ repoRoot: request.run.repoRoot });
  const states = repository.projectionFiles.currentOf({ files: [root.file, ...packages.map((file) => file.file), ...declarations.map((file) => file.file)] });
  if (states.outcome === "failed") {
    return states;
  }
  const rootState = sliceStateOf({ states: states.value, expected: root });
  if (rootState.outcome === "failed") {
    return rootState;
  }
  const problems = gatheredOutcomes({ outcomes: [...packages, ...declarations].map((file) => packageProblemOf({ states: states.value, expected: file })) });
  return problems.outcome === "failed" ? problems : { outcome: "ok", value: { projection: rootState.value, slices: problems.value } };
};

const unconfiguredSlicesOf = (request: { readonly run: ChecksRunRequest; readonly platform: EslintPlatformPorts; readonly slices: ChecksSlices }): readonly ChecksSliceProblem[] =>
  request.slices.packages.flatMap((slice) =>
    slice.directory !== undefined &&
    request.run.declaredConfigRoots.includes(slice.directory) &&
    folderConfigurationOf({ fileText: request.platform.fileText, path: request.platform.path, repoRoot: request.run.repoRoot, folder: slice.directory }) === "unconfigured"
      ? [{ slice: slice.file, state: "unconfigured" as const }]
      : [],
  );

type LintRequest = {
  readonly run: ChecksRunRequest;
  readonly selected: readonly SelectedCheck[];
  readonly plugin: LoadedEslintPlugin;
  readonly queried: QueriedFiles;
  readonly query: QueryInstance;
  readonly ports: ChecksRunnerPorts;
  readonly versionOneRuleIds: readonly VersionOneRuleId[];
};

const lintedReport = async (request: LintRequest & { readonly status: ProjectionStatus }): Promise<Outcome<ChecksRunReport>> => {
  const { run, ports } = request;
  const repository = ports.repositoryAt({ repoRoot: run.repoRoot });
  const linted = await ports.eslint
    .createGovernanceInstance({
      repoRoot: run.repoRoot,
      plugins: { [CHECKS_PLUGIN_NAMESPACE]: request.plugin },
      rules: [...request.selected.map((entry) => ({ ruleId: entry.ruleId, options: entry.options })), { ruleId: MISNAMED_DISABLE_RULE_ID, options: [] }],
    })
    .lintFiles({ files: run.files });
  if (linted.outcome === "failed") {
    return linted;
  }
  const findings = gatheredOutcomes({
    outcomes: linted.value.map((file) =>
      listedOutcome({ outcome: lintedFindingsOf({ linted: file, path: ports.path, repoRoot: run.repoRoot, sourceLines: repository.sourceLines, selected: request.selected, checkRuleIds: eslintRuleIdsOf({ checks: run.checks }), versionOneRuleIds: request.versionOneRuleIds }) }),
    ),
  });
  if (findings.outcome === "failed") {
    return findings;
  }
  const tracked = await trackedExceptionsOf({
    packageScriptsAt: repository.packageScriptsAt,
    suppressionsAt: repository.suppressionsAt,
    trackedPaths: run.trackedPaths,
    selected: request.selected,
    judge: scriptOptionJudge({ query: request.query, eslint: ports.eslint, path: ports.path, repoRoot: run.repoRoot, checked: request.queried.checked.map((checked) => checked.file) }),
  });
  return tracked.outcome === "failed"
    ? tracked
    : {
        outcome: "ok",
        value: {
          hits: findings.value.flatMap((found) => found.hits),
          nativeExceptions: [...queryExceptionsOf({ selected: request.selected, answered: run.answered, queried: request.queried }), ...findings.value.flatMap((found) => found.nativeExceptions), ...tracked.value],
          measured: findings.value.flatMap((found) => found.measured),
          projection: request.status.projection,
          slices: request.status.slices,
          misnamedRuleIds: findings.value.flatMap((found) => found.misnamedRuleIds),
        },
      };
};

const projectionWhenNotInEffect = (request: { readonly status: ProjectionStatus }): ChecksProjectionState =>
  request.status.projection === "current" && request.status.slices.every((slice) => slice.state !== "out-of-date") ? "not-included" : request.status.projection;

const queriedRun = async (
  request: Omit<LintRequest, "queried" | "query"> & { readonly platform: EslintPlatformPorts; readonly status: ProjectionStatus; readonly lookup: EslintConfigLookup },
): Promise<Outcome<ChecksRunReport>> => {
  const query = queryInstanceOf(request);
  if (query.outcome === "failed") {
    return query;
  }
  const queried = await queriedFilesOf({
    query: query.value,
    files: request.run.files,
    ruleIds: request.selected.map((entry) => entry.ruleId),
    location: { path: request.ports.path, repoRoot: request.run.repoRoot, governingIgnoreOf: cachedGoverningIgnores({ eslint: request.ports.eslint }) },
  });
  if (queried.outcome === "failed") {
    return queried;
  }
  return projectionEffectOf({ selected: request.selected, answered: request.run.answered, queried: queried.value }) === "not-in-effect"
    ? reportAs({ projection: projectionWhenNotInEffect({ status: request.status }), slices: request.status.slices })
    : lintedReport({ ...request, query: query.value, queried: queried.value });
};

const projectedRun = async (request: { readonly run: ChecksRunRequest; readonly ports: ChecksRunnerPorts; readonly platform: EslintPlatformPorts }): Promise<Outcome<ChecksRunReport>> => {
  const projected = projectedChecksOf({ checks: request.run.checks, bindings: request.run.bindings });
  if (projected.outcome === "failed") {
    return { outcome: "failed", error: projectionFailureOf({ failure: projected.error }) };
  }
  const selected = selectedChecksOf({ checks: request.run.checks, projected: projected.value });
  if (selected.outcome === "failed" || selected.value.length === 0) {
    return selected.outcome === "failed" ? selected : reportAs({ projection: "current", slices: [] });
  }
  const lookup = lookupOf(request);
  const slices = slicesOver({ run: request.run, lookup });
  const written = currentProjectionStatus({ run: request.run, ports: request.ports, projected: projected.value, slices });
  if (written.outcome === "failed") {
    return written;
  }
  const status: ProjectionStatus = { ...written.value, slices: [...written.value.slices, ...unconfiguredSlicesOf({ run: request.run, platform: request.platform, slices })] };
  if (status.projection === "missing" || status.slices.some((slice) => slice.state === "missing")) {
    return reportAs(status);
  }
  const plugin = await builtPlugin({ ...request, checkRuleIds: eslintRuleIdsOf({ checks: request.run.checks }) });
  return plugin.outcome === "failed"
    ? plugin
    : queriedRun({ run: request.run, platform: request.platform, selected: selected.value, plugin: plugin.value, ports: request.ports, versionOneRuleIds: versionOneRuleIdsOf(request.run), status, lookup });
};

const projectedFilesOf = (request: { readonly run: ChecksRunRequest; readonly ports: ChecksRunnerPorts; readonly platform: EslintPlatformPorts }): Outcome<readonly ProjectedFile[]> => {
  const projected = projectedChecksOf({ checks: request.run.checks, bindings: request.run.bindings });
  if (projected.outcome === "failed") {
    return { outcome: "failed", error: projectionFailureOf({ failure: projected.error }) };
  }
  const selected = selectedChecksOf({ checks: request.run.checks, projected: projected.value });
  if (selected.outcome === "failed" || selected.value.length === 0) {
    return selected.outcome === "failed" ? selected : { outcome: "ok", value: [] };
  }
  const expected = expectedFilesOf({ run: request.run, ports: request.ports, projected: projected.value, slices: slicesOver({ run: request.run, lookup: lookupOf(request) }) });
  return expected.outcome === "failed" ? expected : { outcome: "ok", value: [expected.value.root, ...expected.value.packages, ...expected.value.declarations] };
};

export const checksRunnerOver = (request: { readonly ports: ChecksRunnerPorts; readonly platform: EslintPlatformPorts }): ChecksRunner => ({
  run: (run) => Promise.resolve(notReadyOver({ run })).then((notReady) => notReady ?? projectedRun({ run, ports: request.ports, platform: request.platform })),
  project: (run) => Promise.resolve(notReadyOver({ run }) ?? projectedFilesOf({ run, ports: request.ports, platform: request.platform })),
  conform: (conform) =>
    conformedCases({
      clause: conform.clause,
      cases: conform.cases,
      path: request.ports.path,
      eslint: request.ports.eslint,
      loadedPlugin: ({ configured }) => loadedPieceClauseOf({ configured, modules: request.ports.modules }),
    }),
});

export const createChecksRunner = (platform: EslintPlatformPorts): ChecksRunner =>
  checksRunnerOver({
    platform,
    ports: {
      repositoryAt: ({ repoRoot }) => checksRepositoryOver({ ...platform, repoRoot }),
      coreInstall: ({ installRoot }) => coreInstallOf({ ...platform, installRoot }),
      modules: platform.modules,
      path: platform.path,
      eslint: platform.eslint,
    },
  });

import { z } from "zod";

import type { NamedEngineRunRequest } from "../../../../../application/ports/engine/engine-run.ts";
import type {
  CheckedVersionOneProjection,
  ProjectionMeasurement,
  VersionOneMeasurementRequest,
} from "../../../../../application/ports/upgrade/version-one-measurement.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import { checkNamesOf } from "../../../../../domain/language-layer/check-address-text.ts";
import {
  type AnsweredByPlace,
  answeredByPlaceOf,
} from "../../../../../domain/records/answering/records-by-place.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { ProjectedFile } from "../../../../../domain/runner/checks-run-report.ts";
import type { ChecksSliceProblem } from "../../../../../domain/runner/checks-run-report.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { NativeException } from "../../../../../domain/runner/runner-result-types.ts";
import type { EslintConfigLookup } from "../../../../../domain/settings/eslint-config-lookup.ts";
import type {
  NamedChecksRunner,
  NamedChecksRunReport,
} from "../../../protocol/checks/checks-runner-types.ts";
import { toolchainBoundNamedChecksRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import {
  nestedVersionTwoFoldersOf,
  nestedVersionTwoRepositoriesOf,
  SETTINGS_FILE_NAME,
} from "../config-roots/checks-nested-repositories.ts";
import {
  answeredWithin,
  type ChecksSlice,
  type ChecksSlices,
  declarationPathOf,
  slicesOf,
} from "../config-roots/checks-slices.ts";
import {
  configLookupDeclaring,
  folderConfigurationOf,
  teamConfigLookupFor,
} from "../config-roots/config-lookup.ts";
import { cachedGoverningIgnores } from "../config-roots/governing-config.ts";
import { conformedNamedCases, parsedPluginOf } from "../conformance/eslint-conform.ts";
import {
  CHECKS_PLUGIN_NAMESPACE,
  checkRuleIdOf,
  eslintRuleIdsOf,
} from "../hone-plugin/check-rule-id.ts";
import type { ChecksPlugin } from "../hone-plugin/checks-plugin.ts";
import { honePluginAt, honePluginFailureText } from "../hone-plugin/hone-plugin.ts";
import { namedLintedFindingsOf } from "../lint-findings/checks-lint-findings.ts";
import {
  MISNAMED_DISABLE_RULE,
  MISNAMED_DISABLE_RULE_ID,
  misnamedDisableRule,
} from "../lint-findings/misnamed-disable-rule.ts";
import {
  queriedFiles,
  queriedFilesOf,
  projectionEffectOf,
  namedQueryExceptionsOf,
  type QueriedFiles,
} from "../native-exceptions/checks-queried-files.ts";
import { trackedNamedExceptionsOf } from "../native-exceptions/checks-tracked-exceptions.ts";
import { scriptOptionJudge } from "../native-exceptions/script-option-effect.ts";
import { eslintPieceSettingsSchema } from "../pieces/eslint-piece-settings-schema.ts";
import {
  eslintPluginModuleSchema,
  type LoadedEslintPlugin,
} from "../pieces/eslint-plugin-schema.ts";
import {
  checksProjectionText,
  type ProjectedCheck,
  type ProjectedPlugin,
} from "../projection/checks-projection.ts";
import { coreInstallOf } from "../projection/core-install.ts";
import {
  checksPluginImportOf,
  type ProjectionFailure,
  projectedNamedChecksOf,
} from "../projection/projected-checks.ts";
import { type ProjectionStates, projectionStateAt } from "../projection/projection-states.ts";
import {
  type GeneratedProjectionState as GeneratedState,
  pluginImportOf,
  projectionState,
} from "../projection/projection.ts";
import type { QueryInstance } from "../toolchain/eslint-instance.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import type { ChecksRunnerPorts, EslintPlatformPorts } from "./checks-ports.ts";
import { checksRepositoryOver } from "./checks-repository.ts";
import type {
  ChecksRunFailure,
  ChecksProjectionState,
  SelectedNamedCheck,
  VersionOneRuleId,
} from "./checks-run-types.ts";
import { selectedNamedChecksOf } from "./checks-selection.ts";

type Outcome<Value> = Result<Value, ChecksRunFailure>;
type MeasuredRun = Outcome<ProjectionMeasurement<NamedChecksRunReport>>;

export type EslintChecksRunner = NamedChecksRunner & {
  readonly measureVersionOne: (request: VersionOneMeasurementRequest) => Promise<MeasuredRun>;
};

const measurementOf = (request: {
  readonly result: Outcome<NamedChecksRunReport>;
  readonly unappliedSlices?: readonly RepoPath[];
}): MeasuredRun =>
  request.result.outcome === "failed"
    ? request.result
    : {
        outcome: "ok",
        value: { report: request.result.value, unappliedSlices: request.unappliedSlices ?? [] },
      };

const NO_FINDINGS = { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [] };

const reportAs = (request: {
  readonly projection: ChecksProjectionState;
  readonly slices: readonly ChecksSliceProblem[];
}): Outcome<NamedChecksRunReport> => ({
  outcome: "ok",
  value: { ...NO_FINDINGS, projection: request.projection, slices: request.slices },
});

const toolFailed = (request: {
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "tool-failed", detail: request.detail },
});

const projectionFailureOf = (request: { readonly failure: ProjectionFailure }): RunnerFailure => {
  const { failure } = request;
  switch (failure.kind) {
    case "piece-invalid":
      return failure;
    case "check-unknown":
      return {
        kind: "tool-failed",
        detail: `${failure.address} names no check that runs on ESLint`,
      };
  }
};

const versionOneRuleIdsOf = (
  request: Pick<NamedEngineRunRequest, "bindings">,
): readonly VersionOneRuleId[] => {
  const namesByOldRule = Map.groupBy(
    request.bindings.flatMap(({ address, settings, ruleSet }) => {
      const parsed = eslintPieceSettingsSchema.safeParse(settings);
      const names = checkNamesOf({ text: address });
      if (!parsed.success || names === undefined || ruleSet !== undefined) return [];
      const { pluginNamespace, rule } = parsed.data;
      return [
        {
          ruleId: `${pluginNamespace}/${rule}`,
          replacement: checkRuleIdOf({
            check: { name: names.check, symptom: { name: names.symptom } },
          }),
        },
      ];
    }),
    ({ ruleId }) => ruleId,
  );
  return [...namesByOldRule].map(([ruleId, names]) => ({
    ruleId,
    replacedBy: [...new Set(names.map(({ replacement }) => replacement))],
  }));
};

const lookupRequestOf = (request: {
  readonly run: NamedEngineRunRequest;
  readonly platform: EslintPlatformPorts;
}) => ({
  fileText: request.platform.fileText,
  path: request.platform.path,
  repoRoot: request.run.repoRoot,
  trackedPaths: request.run.trackedPaths,
});

const lookupOf = (request: {
  readonly run: NamedEngineRunRequest;
  readonly platform: EslintPlatformPorts;
}): EslintConfigLookup =>
  configLookupDeclaring({
    ...lookupRequestOf(request),
    declared: request.run.declaredConfigLookup,
  });

const notReadyOver = (request: {
  readonly run: NamedEngineRunRequest;
}): Outcome<never> | undefined => {
  const nested = nestedVersionTwoRepositoriesOf({
    trackedPaths: request.run.trackedPaths,
    files: request.run.files,
  });
  return nested.length > 0
    ? {
        outcome: "failed",
        error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: nested } },
      }
    : undefined;
};

const slicesOver = (request: {
  readonly run: NamedEngineRunRequest;
  readonly lookup: EslintConfigLookup;
}): ChecksSlices =>
  slicesOf({
    trackedPaths: request.run.trackedPaths,
    declared: request.run.declaredConfigRoots,
    lookup: request.lookup,
    nestedRepositories: nestedVersionTwoFoldersOf({ trackedPaths: request.run.trackedPaths }),
  });

const queryInstanceOf = (request: {
  readonly run: NamedEngineRunRequest;
  readonly platform: EslintPlatformPorts;
  readonly ports: ChecksRunnerPorts;
  readonly lookup: EslintConfigLookup;
  readonly settingsFile: string;
}): Result<QueryInstance, RunnerFailure> => {
  const lookup = teamConfigLookupFor({
    ...lookupRequestOf(request),
    lookup: request.lookup,
    settingsFile: request.settingsFile,
  });
  if (lookup.outcome === "failed") {
    return lookup;
  }
  return {
    outcome: "ok",
    value: request.ports.eslint.createQueryInstance(
      lookup.value.kind === "repository-root"
        ? { repoRoot: request.run.repoRoot, configFile: lookup.value.configFile }
        : { repoRoot: request.run.repoRoot },
    ),
  };
};

const loadedPlugin = (request: {
  readonly plugin: ChecksPlugin;
  readonly checkRuleIds: readonly string[];
}): Result<LoadedEslintPlugin, RunnerFailure> => {
  const loaded = eslintPluginModuleSchema.safeParse({
    default: {
      ...request.plugin,
      rules: {
        ...request.plugin.rules,
        [MISNAMED_DISABLE_RULE]: misnamedDisableRule({ checkRuleIds: request.checkRuleIds }),
      },
    },
  });
  return loaded.success
    ? { outcome: "ok", value: loaded.data.default }
    : toolFailed({
        detail: `the Hone plugin is not an ESLint plugin: ${z.prettifyError(loaded.error)}`,
      });
};

const builtPlugin = async (request: {
  readonly run: NamedEngineRunRequest;
  readonly checkRuleIds: readonly string[];
  readonly ports: ChecksRunnerPorts;
  readonly platform: EslintPlatformPorts;
}): Promise<Result<LoadedEslintPlugin, RunnerFailure>> => {
  const plugin = await honePluginAt({
    checks: (request.run.checks ?? []).filter(({ ruleSet }) => ruleSet === undefined),
    installRoot: request.run.installRoot,
    fileText: request.platform.fileText,
    path: request.platform.path,
    modules: request.platform.modules,
    boundary: request.ports.eslint.boundary,
  });
  return plugin.outcome === "failed"
    ? toolFailed({ detail: honePluginFailureText({ failure: plugin.error }) })
    : loadedPlugin({ plugin: plugin.value, checkRuleIds: request.checkRuleIds });
};

type PluginSource = NonNullable<ProjectedCheck["plugin"]>;

const pluginSourcesOf = (request: {
  readonly projected: readonly ProjectedCheck[];
  readonly ports: Pick<ChecksRunnerPorts, "path">;
}): Result<readonly PluginSource[], RunnerFailure> => {
  const sources = new Map<string, PluginSource>();
  const ids = new Set<string>();
  for (const { plugin, ruleId } of request.projected) {
    if (plugin === undefined) continue;
    if (ids.has(ruleId))
      return toolFailed({ detail: `several checks enable the ESLint rule ${ruleId}` });
    ids.add(ruleId);
    const previous = sources.get(plugin.namespace);
    if (
      previous !== undefined &&
      modulePathOf({ ...request, plugin: previous }) !== modulePathOf({ ...request, plugin })
    ) {
      return toolFailed({
        detail: `several modules declare the ESLint plugin ${plugin.namespace}`,
      });
    }
    sources.set(plugin.namespace, plugin);
  }
  return {
    outcome: "ok",
    value: [...sources.values()].toSorted((left, right) =>
      left.namespace.localeCompare(right.namespace, "en"),
    ),
  };
};

const modulePathOf = (request: {
  readonly ports: Pick<ChecksRunnerPorts, "path">;
  readonly plugin: PluginSource;
}): string =>
  request.ports.path.join({ segments: [request.plugin.pieceRoot, request.plugin.module] });

const externalPluginsOf = async (request: {
  readonly projected: readonly ProjectedCheck[];
  readonly platform: EslintPlatformPorts;
  readonly ports: ChecksRunnerPorts;
}): Promise<Result<readonly (readonly [string, LoadedEslintPlugin])[], RunnerFailure>> => {
  const sources = pluginSourcesOf(request);
  if (sources.outcome === "failed") return sources;
  return gatheredOutcomes({
    outcomes: await Promise.all(
      sources.value.map(
        async (
          plugin,
        ): Promise<Result<readonly (readonly [string, LoadedEslintPlugin])[], RunnerFailure>> => {
          const path = modulePathOf({ ...request, plugin });
          const parsed = parsedPluginOf({ loaded: await request.platform.modules.load({ path }) });
          return parsed.outcome === "failed"
            ? toolFailed({
                detail: `the plugin module ${path} could not be loaded: ${parsed.error.detail}`,
              })
            : { outcome: "ok", value: [[plugin.namespace, parsed.value]] };
        },
      ),
    ),
  });
};

type SliceRequest = {
  readonly run: NamedEngineRunRequest;
  readonly projected: readonly ProjectedCheck[];
  readonly ports: ChecksRunnerPorts;
  readonly slices: ChecksSlices;
};

type ExpectedFiles = {
  readonly root: ProjectedFile;
  readonly packages: readonly ProjectedFile[];
  readonly declarations: readonly ProjectedFile[];
};

type ProjectionStatus = {
  readonly projection: GeneratedState;
  readonly slices: readonly ChecksSliceProblem[];
};

const importingDirectoryOf = (request: {
  readonly run: NamedEngineRunRequest;
  readonly ports: ChecksRunnerPorts;
  readonly slice: ChecksSlice;
}): Result<AbsolutePath, RunnerFailure> => {
  const { directory } = request.slice;
  if (directory === undefined) {
    return { outcome: "ok", value: request.run.repoRoot };
  }
  const resolved = request.ports.path.resolve({
    path: request.ports.path.join({ segments: [request.run.repoRoot, directory] }),
  });
  return resolved.outcome === "ok"
    ? resolved
    : toolFailed({
        detail: `${directory} does not resolve to a folder of ${request.run.repoRoot}`,
      });
};

const expectedSliceOf = (
  request: Omit<SliceRequest, "slices"> & { readonly slice: ChecksSlice },
): Result<ProjectedFile, RunnerFailure> => {
  const install = request.ports.coreInstall({ installRoot: request.run.installRoot });
  if (install.outcome === "failed") {
    return install;
  }
  const importing = importingDirectoryOf(request);
  if (importing.outcome === "failed") {
    return importing;
  }
  const pluginImport = checksPluginImportOf({
    path: request.ports.path,
    importingDirectory: importing.value,
    installRoot: request.run.installRoot,
    install: install.value,
  });
  const sources = pluginSourcesOf(request);
  if (sources.outcome === "failed") return sources;
  const plugins = gatheredOutcomes({
    outcomes: sources.value.map((source): Result<readonly ProjectedPlugin[], RunnerFailure> => {
      const imported = pluginImportOf({
        path: request.ports.path,
        importingDirectory: importing.value,
        install: install.value,
        pieceRoot: source.pieceRoot,
        pluginModule: source.module,
      });
      return imported.placement === "importable"
        ? { outcome: "ok", value: [{ namespace: source.namespace, specifier: imported.specifier }] }
        : toolFailed({
            detail: `the ${source.namespace} plugin cannot be imported from ${importing.value}`,
          });
    }),
  });
  if (plugins.outcome === "failed") return plugins;
  return pluginImport.placement === "importable"
    ? {
        outcome: "ok",
        value: {
          file: request.slice.file,
          text: checksProjectionText({
            pluginImport: pluginImport.specifier,
            plugins: plugins.value,
            checks: request.projected,
            answered: answeredWithin({ answered: request.run.answered, slice: request.slice }),
          }),
        },
      }
    : toolFailed({ detail: `the Hone plugin cannot be imported from ${importing.value}` });
};

const expectedDeclarationOf = (request: {
  readonly slice: ChecksSlice;
  readonly boundary: EslintMajorBoundary;
}): ProjectedFile => ({
  file: declarationPathOf(request),
  text: request.boundary.declarationText,
});

const expectedFilesOf = (request: SliceRequest): Result<ExpectedFiles, RunnerFailure> => {
  const root = expectedSliceOf({ ...request, slice: request.slices.root });
  if (root.outcome === "failed") {
    return root;
  }
  const packages = gatheredOutcomes({
    outcomes: request.slices.packages.map((slice) =>
      listedOutcome({ outcome: expectedSliceOf({ ...request, slice }) }),
    ),
  });
  return packages.outcome === "failed"
    ? packages
    : {
        outcome: "ok",
        value: {
          root: root.value,
          packages: packages.value,
          declarations: [request.slices.root, ...request.slices.packages].map((slice) =>
            expectedDeclarationOf({ slice, boundary: request.ports.eslint.boundary }),
          ),
        },
      };
};

const sliceStateOf = (request: {
  readonly states: ProjectionStates;
  readonly expected: ProjectedFile;
}): Result<GeneratedState, RunnerFailure> => {
  const current = projectionStateAt({ states: request.states, file: request.expected.file });
  return current.outcome === "failed"
    ? current
    : {
        outcome: "ok",
        value: projectionState({ current: current.value, generated: request.expected.text }),
      };
};

const packageProblemOf = (request: {
  readonly states: ProjectionStates;
  readonly expected: ProjectedFile;
}): Result<readonly ChecksSliceProblem[], RunnerFailure> => {
  const state = sliceStateOf(request);
  if (state.outcome === "failed") {
    return state;
  }
  return {
    outcome: "ok",
    value: state.value === "current" ? [] : [{ slice: request.expected.file, state: state.value }],
  };
};

const currentProjectionStatus = (
  request: SliceRequest,
): Result<ProjectionStatus, RunnerFailure> => {
  const expected = expectedFilesOf(request);
  if (expected.outcome === "failed") {
    return expected;
  }
  const { root, packages, declarations } = expected.value;
  const repository = request.ports.repositoryAt({ repoRoot: request.run.repoRoot });
  const states = repository.projectionFiles.currentOf({
    files: [
      root.file,
      ...packages.map((file) => file.file),
      ...declarations.map((file) => file.file),
    ],
  });
  if (states.outcome === "failed") {
    return states;
  }
  const rootState = sliceStateOf({ states: states.value, expected: root });
  if (rootState.outcome === "failed") {
    return rootState;
  }
  const problems = gatheredOutcomes({
    outcomes: [...packages, ...declarations].map((file) =>
      packageProblemOf({ states: states.value, expected: file }),
    ),
  });
  return problems.outcome === "failed"
    ? problems
    : { outcome: "ok", value: { projection: rootState.value, slices: problems.value } };
};

const unconfiguredSlicesOf = (request: {
  readonly run: NamedEngineRunRequest;
  readonly platform: EslintPlatformPorts;
  readonly slices: ChecksSlices;
}): readonly ChecksSliceProblem[] =>
  request.slices.packages.flatMap((slice) =>
    slice.directory !== undefined &&
    request.run.declaredConfigRoots.includes(slice.directory) &&
    folderConfigurationOf({
      fileText: request.platform.fileText,
      path: request.platform.path,
      repoRoot: request.run.repoRoot,
      folder: slice.directory,
    }) === "unconfigured"
      ? [{ slice: slice.file, state: "unconfigured" as const }]
      : [],
  );

type LintRequest = {
  readonly answeredByPlace: AnsweredByPlace;
  readonly run: NamedEngineRunRequest;
  readonly selected: readonly SelectedNamedCheck[];
  readonly checkRuleIds: readonly string[];
  readonly projectionSelected: readonly SelectedNamedCheck[];
  readonly plugins: Readonly<Record<string, LoadedEslintPlugin>>;
  readonly queried: QueriedFiles;
  readonly query: QueryInstance;
  readonly ports: ChecksRunnerPorts;
  readonly versionOneRuleIds: readonly VersionOneRuleId[];
};

const lintedReport = async (
  request: LintRequest & { readonly status: ProjectionStatus },
): Promise<Outcome<NamedChecksRunReport>> => {
  const { run, ports } = request;
  const repository = ports.repositoryAt({ repoRoot: run.repoRoot });
  const linted = await ports.eslint
    .createGovernanceInstance({
      repoRoot: run.repoRoot,
      plugins: request.plugins,
      rules: [
        ...request.selected.map((entry) => ({ ruleId: entry.ruleId, options: entry.options })),
        { ruleId: MISNAMED_DISABLE_RULE_ID, options: [] },
      ],
    })
    .lintFiles({ files: run.files });
  if (linted.outcome === "failed") {
    return linted;
  }
  const findings = gatheredOutcomes({
    outcomes: linted.value.map((file) =>
      listedOutcome({
        outcome: namedLintedFindingsOf({
          linted: file,
          path: ports.path,
          repoRoot: run.repoRoot,
          sourceLines: repository.sourceLines,
          selected: request.selected,
          checkRuleIds: request.checkRuleIds,
          versionOneRuleIds: request.versionOneRuleIds,
        }),
      }),
    ),
  });
  if (findings.outcome === "failed") {
    return findings;
  }
  const tracked = await trackedNamedExceptionsOf({
    packageScriptsAt: repository.packageScriptsAt,
    suppressionsAt: repository.suppressionsAt,
    trackedPaths: run.trackedPaths,
    selected: request.projectionSelected,
    judge: scriptOptionJudge({
      query: request.query,
      eslint: ports.eslint,
      path: ports.path,
      repoRoot: run.repoRoot,
      checked: request.queried.checked.map((checked) => checked.file),
    }),
  });
  return tracked.outcome === "failed"
    ? tracked
    : {
        outcome: "ok",
        value: {
          hits: findings.value.flatMap((found) => found.hits),
          nativeExceptions: [
            ...namedQueryExceptionsOf({
              selected: request.projectionSelected,
              answeredByPlace: request.answeredByPlace,
              queried: request.queried,
            }),
            ...findings.value.flatMap((found) => found.nativeExceptions),
            ...tracked.value,
          ],
          measured: findings.value.flatMap((found) => found.measured),
          projection: request.status.projection,
          slices: request.status.slices,
          misnamedRuleIds: findings.value.flatMap((found) => found.misnamedRuleIds),
        },
      };
};

const projectionWhenNotInEffect = (request: {
  readonly status: ProjectionStatus;
}): ChecksProjectionState =>
  request.status.projection === "current" &&
  request.status.slices.every((slice) => slice.state !== "out-of-date")
    ? "not-included"
    : request.status.projection;

const unappliedPackageSlicesOf = (request: {
  readonly answeredByPlace: AnsweredByPlace;
  readonly packageFiles: readonly RepoPath[];
  readonly selected: readonly SelectedNamedCheck[];
  readonly queried: QueriedFiles;
}): readonly RepoPath[] => {
  const directories = request.packageFiles.map((file) => ({
    file,
    prefix: file.slice(0, file.lastIndexOf("/") + 1),
  }));
  const checkedByDirectory = Map.groupBy(
    request.queried.checked,
    ({ file }) =>
      directories
        .filter(({ prefix }) => file.startsWith(prefix))
        .toSorted((left, right) => right.prefix.length - left.prefix.length)[0]?.file,
  );
  return directories.flatMap(({ file }) => {
    const checked = checkedByDirectory.get(file) ?? [];
    return projectionEffectOf({
      selected: request.selected,
      answeredByPlace: request.answeredByPlace,
      queried: { checked, ignored: [] },
    }) === "not-in-effect"
      ? [file]
      : [];
  });
};

const queriedRun = async (
  request: Omit<LintRequest, "queried" | "query" | "projectionSelected" | "answeredByPlace"> & {
    readonly platform: EslintPlatformPorts;
    readonly status: ProjectionStatus;
    readonly lookup: EslintConfigLookup;
    readonly versionOneProjection: CheckedVersionOneProjection | undefined;
  },
): Promise<MeasuredRun> => {
  const source = request.versionOneProjection;
  const query = queryInstanceOf({
    ...request,
    settingsFile: source?.settingsFile ?? SETTINGS_FILE_NAME,
  });
  if (query.outcome === "failed") {
    return query;
  }
  const projectionSelected = request.selected.map((entry) => ({
    ...entry,
    ruleId: source?.rules.get(entry.address) ?? entry.ruleId,
  }));
  const lookup = {
    query: query.value,
    files: request.run.files,
    ruleIds: projectionSelected.map((entry) => entry.ruleId),
    location: {
      path: request.ports.path,
      repoRoot: request.run.repoRoot,
      governingIgnoreOf: cachedGoverningIgnores({ eslint: request.ports.eslint }),
    },
  };
  const queried = await (source === undefined
    ? queriedFilesOf(lookup)
    : queriedFiles({
        ...lookup,
        location: {
          ...lookup.location,
          names: { settingsFile: source.settingsFile, projectionFile: source.projectionFile },
        },
      }));
  if (queried.outcome === "failed") {
    return queried;
  }
  const answeredByPlace = answeredByPlaceOf({ answered: request.run.answered });
  const { status } = request;
  const unappliedSlices =
    source === undefined
      ? []
      : unappliedPackageSlicesOf({
          answeredByPlace,
          packageFiles: source.packageFiles,
          selected: projectionSelected,
          queried: queried.value,
        });
  const result =
    projectionEffectOf({
      selected: projectionSelected,
      answeredByPlace,
      queried: queried.value,
    }) === "not-in-effect"
      ? reportAs({ projection: projectionWhenNotInEffect({ status }), slices: status.slices })
      : await lintedReport({
          ...request,
          status,
          projectionSelected,
          answeredByPlace,
          query: query.value,
          queried: queried.value,
        });
  return measurementOf({ result, unappliedSlices });
};

const projectedRun = async (request: {
  readonly run: NamedEngineRunRequest;
  readonly ports: ChecksRunnerPorts;
  readonly platform: EslintPlatformPorts;
  readonly versionOneProjection: CheckedVersionOneProjection | undefined;
  readonly projectionStatusOf: (request: SliceRequest) => Result<ProjectionStatus, RunnerFailure>;
}): Promise<MeasuredRun> => {
  const projected = projectedNamedChecksOf({
    checks: request.run.checks ?? [],
    bindings: request.run.bindings,
  });
  if (projected.outcome === "failed") {
    return { outcome: "failed", error: projectionFailureOf({ failure: projected.error }) };
  }
  const selected = selectedNamedChecksOf({
    checks: request.run.checks ?? [],
    projected: projected.value,
  });
  if (selected.outcome === "failed" || selected.value.length === 0) {
    return selected.outcome === "failed"
      ? selected
      : measurementOf({ result: reportAs({ projection: "current", slices: [] }) });
  }
  const lookup = lookupOf(request);
  const slices = slicesOver({ run: request.run, lookup });
  const written = request.projectionStatusOf({
    run: request.run,
    ports: request.ports,
    projected: projected.value,
    slices,
  });
  if (written.outcome === "failed") {
    return written;
  }
  const status: ProjectionStatus = {
    ...written.value,
    slices: [
      ...written.value.slices,
      ...unconfiguredSlicesOf({ run: request.run, platform: request.platform, slices }),
    ],
  };
  if (status.projection === "missing" || status.slices.some((slice) => slice.state === "missing")) {
    return measurementOf({ result: reportAs(status) });
  }
  const checkRuleIds = [
    ...eslintRuleIdsOf({
      checks: (request.run.checks ?? []).filter(({ ruleSet }) => ruleSet === undefined),
    }),
    ...selected.value.map(({ ruleId }) => ruleId),
  ];
  const plugin = await builtPlugin({ ...request, checkRuleIds });
  if (plugin.outcome === "failed") return plugin;
  const external = await externalPluginsOf({ ...request, projected: projected.value });
  if (external.outcome === "failed") return external;
  return queriedRun({
    run: request.run,
    platform: request.platform,
    selected: selected.value,
    checkRuleIds,
    plugins: { [CHECKS_PLUGIN_NAMESPACE]: plugin.value, ...Object.fromEntries(external.value) },
    ports: request.ports,
    versionOneRuleIds: versionOneRuleIdsOf(request.run),
    status,
    lookup,
    versionOneProjection: request.versionOneProjection,
  });
};

const projectedFilesOf = (request: {
  readonly run: NamedEngineRunRequest;
  readonly ports: ChecksRunnerPorts;
  readonly platform: EslintPlatformPorts;
}): Outcome<readonly ProjectedFile[]> => {
  const projected = projectedNamedChecksOf({
    checks: request.run.checks ?? [],
    bindings: request.run.bindings,
  });
  if (projected.outcome === "failed") {
    return { outcome: "failed", error: projectionFailureOf({ failure: projected.error }) };
  }
  const selected = selectedNamedChecksOf({
    checks: request.run.checks ?? [],
    projected: projected.value,
  });
  if (selected.outcome === "failed" || selected.value.length === 0) {
    return selected.outcome === "failed" ? selected : { outcome: "ok", value: [] };
  }
  const expected = expectedFilesOf({
    run: request.run,
    ports: request.ports,
    projected: projected.value,
    slices: slicesOver({ run: request.run, lookup: lookupOf(request) }),
  });
  return expected.outcome === "failed"
    ? expected
    : {
        outcome: "ok",
        value: [expected.value.root, ...expected.value.packages, ...expected.value.declarations],
      };
};

export const checksRunnerOver = (request: {
  readonly ports: ChecksRunnerPorts;
  readonly platform: EslintPlatformPorts;
}): EslintChecksRunner => ({
  run: async (run) => {
    const notReady = notReadyOver({ run });
    if (notReady !== undefined) return notReady;
    const measured = await projectedRun({
      ...request,
      run,
      versionOneProjection: undefined,
      projectionStatusOf: currentProjectionStatus,
    });
    return measured.outcome === "failed"
      ? measured
      : { outcome: "ok", value: measured.value.report };
  },
  measureVersionOne: ({ run, projection }) =>
    Promise.resolve(notReadyOver({ run })).then(
      (notReady) =>
        notReady ??
        projectedRun({
          ...request,
          run,
          versionOneProjection: projection,
          projectionStatusOf: () => ({
            outcome: "ok",
            value: { projection: "current", slices: [] },
          }),
        }),
    ),
  project: (run) =>
    Promise.resolve(
      notReadyOver({ run }) ??
        projectedFilesOf({ run, ports: request.ports, platform: request.platform }),
    ),
  conform: (conform) =>
    conformedNamedCases({
      binding: conform.binding,
      cases: conform.cases,
      path: request.ports.path,
      eslint: request.ports.eslint,
      modules: request.ports.modules,
    }),
});

export const createChecksRunner = (platform: EslintPlatformPorts): EslintChecksRunner =>
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

export const bindEslintChecksModule = (request: {
  readonly runner: Promise<Result<EslintChecksRunner, RunnerFailure>>;
  readonly projectedKinds: readonly NativeException["kind"][];
}) => {
  const measureVersionOne: EslintChecksRunner["measureVersionOne"] = (measurement) =>
    request.runner.then((built) =>
      built.outcome === "failed" ? built : built.value.measureVersionOne(measurement),
    );
  return {
    namedChecksRunner: toolchainBoundNamedChecksRunner({
      fileScope: "typescript",
      toolchain: request.runner,
      projectedKinds: request.projectedKinds,
      runnerOf: (loaded) => loaded,
    }),
    measureVersionOne,
  };
};

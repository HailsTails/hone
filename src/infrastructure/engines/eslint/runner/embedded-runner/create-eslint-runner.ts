import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { EmbeddedRunReport, ReturnedEmbeddedRunReport } from "../../../protocol/embedded/embedded-run-report-schema.ts";
import type { EmbeddedRunner, EmbeddedRunRequest } from "../../../protocol/embedded/embedded-runner-module-schema.ts";
import type { ProjectionRequest } from "../../../../../application/ports/engine/runner-module.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import type { Hit, MeasuredPair, NativeException, ProjectionWrite } from "../../../../../domain/runner/runner-result-types.ts";
import type { SliceProblem } from "../../../../../domain/runner/mechanism-run.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { sameClauseAddress } from "../../../../../domain/rule-set/clause-address.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { measuredOn, parseableFile } from "../lint-findings/checks-lint-findings.ts";
import { mappedOutcome } from "../checks-outcomes.ts";
import { type ConfigLocation, queriedFiles, type QueriedFiles } from "../native-exceptions/checks-queried-files.ts";
import { allOffIn, type CheckedFile, enabledEverywhere, ignoreExceptionsOf, overrideExceptionsOf, type ProjectionEffect, type RuleTarget } from "../native-exceptions/checks-rule-effects.ts";
import { trackedExceptionsOfRules } from "../native-exceptions/checks-tracked-exceptions.ts";
import type { ChecksRunnerPorts, EslintPlatformPorts } from "../checks-runner/checks-ports.ts";
import { type CoreInstall, coreInstallOf } from "../projection/core-install.ts";
import { type EslintRepository, eslintRepositoryOver } from "./eslint-repository.ts";
import type { EslintPort, GovernedRule, LintedFile, QueryInstance } from "../toolchain/eslint-instance.ts";
import { ruleOptionsOf } from "../pieces/eslint-piece-settings-schema.ts";
import type { LoadedEslintPlugin } from "../pieces/eslint-plugin-schema.ts";
import { cachedGoverningIgnores } from "../config-roots/governing-config.ts";
import {
  type ConfiguredClause,
  conformedCases,
  configuredClause,
  type LoadedClause,
  type Outcome,
  type ParsedPlugin,
  parsedPluginOf,
  pieceInvalid,
  pluginOf,
} from "../conformance/eslint-conform.ts";
import { hitsCutFrom, messageReadingOf } from "../lint-findings/lint-hits.ts";
import { type LinesReader, sourceLinesFor } from "../lint-findings/source-lines.ts";
import type { ConfigLookup } from "../config-roots/config-lookup.ts";
import type { SelectedRule } from "../native-exceptions/package-script-scanner.ts";
import { scriptOptionJudge } from "../native-exceptions/script-option-effect.ts";
import {
  type CurrentProjection,
  type ProjectionFiles,
  pluginImportOf,
  projectionState,
} from "../projection/projection.ts";
import { PROJECTION_PATH } from "../projection/projection-text.ts";
import { projectionHolding } from "../projection/projection-holding.ts";
import { projectionStateAt } from "../projection/projection-states.ts";
import {
  type ConfigRoot,
  configRootsOf,
  governingPackageOf,
  packageFoldersOf,
  nestedConfigurationFoldersOf,
  unprojectedFoldersOf,
  slicePathOf,
} from "../config-roots/projection-slices.ts";
import {
  packageSliceProblemsOf,
  type ProjectionClause,
  type SliceOrigin,
  slicedProjectionWrites,
  sliceTextOf,
} from "../config-roots/sliced-projection.ts";

export type EslintRunnerPorts = Omit<ChecksRunnerPorts, "repositoryAt"> & {
  readonly repositoryAt: (request: { readonly repoRoot: AbsolutePath }) => EslintRepository;
};

type EslintRunReport = ReturnedEmbeddedRunReport & Required<Pick<EmbeddedRunReport, "measured">>;

type SelectedClause = LoadedClause<ConfiguredClause>;

type ProjectionStatus = { readonly projection: "current" | "out-of-date"; readonly slices: readonly SliceProblem[] };

type SliceSource = {
  readonly clauses: readonly ProjectionClause[];
  readonly records: readonly ExceptionRecord[];
  readonly origin: SliceOrigin;
};

type SharedPlugin = { readonly configured: ConfiguredClause; readonly parsed: Promise<ParsedPlugin> };

type ImportOrigin = { readonly repoRoot: AbsolutePath; readonly install: CoreInstall };

const importableClause = (request: {
  readonly configured: ConfiguredClause;
  readonly path: PathPort;
  readonly origin: ImportOrigin;
}): Outcome<ConfiguredClause> => {
  const pluginImport = pluginImportOf({
    path: request.path,
    importingDirectory: request.origin.repoRoot,
    install: request.origin.install,
    pieceRoot: request.configured.clause.pieceRoot,
    pluginModule: request.configured.settings.pluginModule,
  });
  if (pluginImport.placement === "piece-on-another-root") {
    return pieceInvalid({
      pieceRoot: request.configured.clause.pieceRoot,
      detail:
        "the piece is on a different root from the repository, so the committed projection cannot import it by a relative path",
    });
  }
  return { outcome: "ok", value: request.configured };
};

const importableConfiguredClause = (request: {
  readonly clause: RunnerClause;
  readonly path: PathPort;
  readonly origin: ImportOrigin;
}): Outcome<ConfiguredClause> => {
  const configured = configuredClause({ clause: request.clause, path: request.path });
  if (configured.outcome === "failed") {
    return configured;
  }
  return importableClause({ configured: configured.value, path: request.path, origin: request.origin });
};

const clashOf = (request: {
  readonly earlier: ConfiguredClause;
  readonly entry: ConfiguredClause;
}): "clashing" | "distinct" =>
  request.earlier.ruleId === request.entry.ruleId ||
  (request.earlier.settings.pluginNamespace === request.entry.settings.pluginNamespace &&
    request.earlier.modulePath !== request.entry.modulePath)
    ? "clashing"
    : "distinct";

const clashingClause = (request: {
  readonly configured: readonly ConfiguredClause[];
}): ConfiguredClause | undefined =>
  request.configured.find((entry, index) =>
    request.configured.slice(0, index).some((earlier) => clashOf({ earlier, entry }) === "clashing"),
  );

const configuredSelection = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
  readonly origin: ImportOrigin;
}): Outcome<readonly ConfiguredClause[]> => {
  const configured = gatheredOutcomes({
    outcomes: request.clauses.map((clause) =>
      listedOutcome({ outcome: importableConfiguredClause({ clause, path: request.path, origin: request.origin }) }),
    ),
  });
  if (configured.outcome === "failed") {
    return configured;
  }
  const clashing = clashingClause({ configured: configured.value });
  if (clashing !== undefined) {
    return pieceInvalid({
      pieceRoot: clashing.clause.pieceRoot,
      detail: `the rule ${clashing.ruleId} or its plugin namespace ${clashing.settings.pluginNamespace} is already selected from another piece`,
    });
  }
  return configured;
};

const parsedPlugin = (request: {
  readonly modulePath: string;
  readonly modules: ModuleLoaderPort;
}): Promise<ParsedPlugin> =>
  request.modules.load({ path: request.modulePath }).then((loaded) => parsedPluginOf({ loaded }));

const loadedPlugin = (request: {
  readonly configured: ConfiguredClause;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<LoadedClause<ConfiguredClause>>> =>
  parsedPlugin({ modulePath: request.configured.modulePath, modules: request.modules }).then((parsed) =>
    pluginOf({ parsed, configured: request.configured }),
  );

const distinctModules = (request: {
  readonly configured: readonly ConfiguredClause[];
  readonly modules: ModuleLoaderPort;
}): readonly { readonly modulePath: string; readonly parsed: Promise<ParsedPlugin> }[] =>
  [...new Set(request.configured.map((entry) => entry.modulePath))].map((modulePath) => ({
    modulePath,
    parsed: parsedPlugin({ modulePath, modules: request.modules }),
  }));

const sharedPluginsOf = (request: {
  readonly entry: ConfiguredClause;
  readonly loaded: readonly { readonly modulePath: string; readonly parsed: Promise<ParsedPlugin> }[];
}): readonly SharedPlugin[] =>
  request.loaded
    .filter((module) => module.modulePath === request.entry.modulePath)
    .map((module) => ({ configured: request.entry, parsed: module.parsed }));

const sharedPlugins = (request: {
  readonly configured: readonly ConfiguredClause[];
  readonly modules: ModuleLoaderPort;
}): readonly SharedPlugin[] => {
  const loaded = distinctModules(request);
  return request.configured.flatMap((entry) => sharedPluginsOf({ entry, loaded }));
};

const listedSelection = (request: { readonly shared: SharedPlugin }): Promise<Outcome<readonly SelectedClause[]>> =>
  request.shared.parsed.then((parsed) =>
    listedOutcome({ outcome: pluginOf({ parsed, configured: request.shared.configured }) }),
  );

const selectedClauses = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
  readonly origin: ImportOrigin;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<readonly SelectedClause[]>> => {
  const configured = configuredSelection({ clauses: request.clauses, path: request.path, origin: request.origin });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  return Promise.all(
    sharedPlugins({ configured: configured.value, modules: request.modules }).map((shared) =>
      listedSelection({ shared }),
    ),
  ).then((outcomes) => gatheredOutcomes({ outcomes }));
};

const projectionClausesOf = (request: {
  readonly configured: readonly ConfiguredClause[];
}): readonly ProjectionClause[] =>
  request.configured.map((entry) => ({
    address: entry.clause.address,
    ruleId: entry.ruleId,
    options: ruleOptionsOf({ settings: entry.settings }),
    pluginNamespace: entry.settings.pluginNamespace,
    pieceRoot: entry.clause.pieceRoot,
    pluginModule: entry.settings.pluginModule,
  }));

const sliceOriginOf = (request: { readonly path: PathPort; readonly origin: ImportOrigin }): SliceOrigin => ({
  path: request.path,
  repoRoot: request.origin.repoRoot,
  install: request.origin.install,
});

const unconfiguredSlicesOf = (request: {
  readonly folderConfiguration: EslintRepository["folderConfiguration"];
  readonly run: EmbeddedRunRequest;
  readonly roots: readonly ConfigRoot[];
}): readonly SliceProblem[] =>
  request.roots.flatMap((root) =>
    root.placement === "package" &&
    request.run.declaredConfigRoots.includes(root.directory) &&
    request.folderConfiguration({ folder: root.directory }) === "unconfigured"
      ? [{ slice: slicePathOf({ root }), state: "unconfigured" as const }]
      : [],
  );

const VERSION_ONE_NAMES: ConfigLocation["names"] = { settingsFile: "disciplines.json", projectionFile: "disciplines.eslint.mjs" };

const ruleIdsOfRecord = (request: {
  readonly record: ExceptionRecord;
  readonly selected: readonly SelectedClause[];
}): readonly string[] =>
  request.selected
    .filter(
      (entry) =>
        sameClauseAddress({ left: entry.clause.address, right: request.record.clause }) === "same",
    )
    .map((entry) => entry.ruleId);

const governedChecked = (request: {
  readonly record: ExceptionRecord;
  readonly checked: readonly CheckedFile[];
  readonly checkedByFile: ReadonlyMap<string, readonly CheckedFile[]>;
}): readonly CheckedFile[] => {
  const record = request.record;
  if (record.kind === "clause-wide-carve-out") {
    return request.checked;
  }
  return request.checkedByFile.get(record.file) ?? [];
};

const recordEffect = (request: {
  readonly record: ExceptionRecord;
  readonly selected: readonly SelectedClause[];
  readonly checked: readonly CheckedFile[];
  readonly checkedByFile: ReadonlyMap<string, readonly CheckedFile[]>;
}): ProjectionEffect => {
  const ruleIds = ruleIdsOfRecord({ record: request.record, selected: request.selected });
  return governedChecked(request).every(
    (checked) => allOffIn({ checked, ruleIds }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";
};

const exemptingEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect => {
  const checkedByFile = Map.groupBy(request.checked, (checked): string => checked.file);
  return request.records.every(
    (record) => recordEffect({ record, selected: request.selected, checked: request.checked, checkedByFile }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";
};

const projectionEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): ProjectionEffect => {
  const enabled = enabledEverywhere({ ruleIds: request.selected.map((entry) => entry.ruleId), checked: request.queried.checked });
  const exempting = exemptingEffect({
    selected: request.selected,
    records: request.records,
    checked: request.queried.checked,
  });
  return enabled === "in-effect" && exempting === "in-effect" ? "in-effect" : "not-in-effect";
};

const targetsOf = (request: { readonly selected: readonly SelectedClause[] }): readonly RuleTarget[] =>
  request.selected.map((entry) => ({ ruleId: entry.ruleId, clause: entry.clause.address, check: undefined }));

const queryExceptions = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): readonly NativeException[] => [
  ...request.queried.ignored.flatMap((file) => ignoreExceptionsOf({ targets: targetsOf(request), file })),
  ...request.queried.checked.flatMap((checked) =>
    overrideExceptionsOf({
      targets: targetsOf(request),
      checked,
      holding: (target) => (projectionHolding({ records: request.records, clause: target.clause, file: checked.file }) === "not-held" ? "does-not-hold" : "holds"),
    }),
  ),
];

type LintFindings = {
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly measured: readonly MeasuredPair[];
};

const lintedFindings = (request: {
  readonly linted: LintedFile;
  readonly selected: readonly SelectedClause[];
  readonly path: PathPort;
  readonly sourceLines: LinesReader;
  readonly repoRoot: AbsolutePath;
}): Outcome<LintFindings> => {
  const file = parseableFile({ linted: request.linted, path: request.path, repoRoot: request.repoRoot });
  if (file.outcome === "failed") {
    return file;
  }
  const reading = messageReadingOf({ file: file.value, messages: request.linted.messages, selected: request.selected });
  if (reading.outcome === "failed") {
    return reading;
  }
  const lines = sourceLinesFor({
    file: file.value,
    ruleHits: reading.value.ruleHits,
    readLines: request.sourceLines,
  });
  return mappedOutcome({
    outcome: lines,
    map: (sourceLines): LintFindings => ({
      hits: hitsCutFrom({ file: file.value, ruleHits: reading.value.ruleHits, lines: sourceLines }),
      nativeExceptions: reading.value.nativeExceptions,
      measured: measuredOn({ file: file.value, linted: request.linted, clauses: request.selected.map((entry) => entry.clause.address) }),
    }),
  });
};

const trackedExceptions = trackedExceptionsOfRules;

const reportWith = (request: {
  readonly projection: ReturnedEmbeddedRunReport["projection"];
  readonly slices: readonly SliceProblem[];
}): Outcome<EslintRunReport> => ({
  outcome: "ok",
  value: { hits: [], nativeExceptions: [], projection: request.projection, slices: request.slices, measured: [] },
});

const ruleIdsOf = (request: { readonly selected: readonly SelectedClause[] }): readonly string[] =>
  request.selected.map((entry) => entry.ruleId);

const governedRulesOf = (request: { readonly selected: readonly SelectedClause[] }): readonly GovernedRule[] =>
  request.selected.map((entry) => ({ ruleId: entry.ruleId, options: ruleOptionsOf({ settings: entry.settings }) }));

const pluginsByNamespace = (request: {
  readonly selected: readonly SelectedClause[];
}): Readonly<Record<string, LoadedEslintPlugin>> =>
  Object.fromEntries(request.selected.map((entry) => [entry.settings.pluginNamespace, entry.plugin]));

const selectedRulesOf = (request: { readonly selected: readonly SelectedClause[] }): readonly SelectedRule[] =>
  request.selected.map((entry) => ({ ruleId: entry.ruleId, clause: entry.clause.address }));

const recordsUnderCheck = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly checked: readonly CheckedFile[];
}): readonly ExceptionRecord[] => {
  const checkedFiles = new Set<string>(request.checked.map((checked) => checked.file));
  return request.records.filter((record) => record.kind === "clause-wide-carve-out" || checkedFiles.has(record.file));
};

const fileRecordsOf = (request: {
  readonly records: readonly ExceptionRecord[];
}): readonly Exclude<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }>[] =>
  request.records.flatMap((record) => (record.kind === "clause-wide-carve-out" ? [] : [record]));

const governedLint = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly eslint: EslintPort;
}): Promise<Outcome<readonly LintedFile[]>> => {
  if (request.run.files.length === 0 || request.selected.length === 0) {
    return Promise.resolve({ outcome: "ok", value: [] });
  }
  return request.eslint
    .createGovernanceInstance({
      repoRoot: request.run.repoRoot,
      plugins: pluginsByNamespace({ selected: request.selected }),
      rules: governedRulesOf({ selected: request.selected }),
    })
    .lintFiles({ files: request.run.files });
};

const governedReport = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly status: ProjectionStatus;
  readonly ports: EslintRunnerPorts;
  readonly repository: EslintRepository;
  readonly query: QueryInstance;
  readonly queried: QueriedFiles;
  readonly lintedFiles: readonly LintedFile[];
}): Promise<Outcome<EslintRunReport>> => {
  const findings = gatheredOutcomes({
    outcomes: request.lintedFiles.map((linted) =>
      listedOutcome({
        outcome: lintedFindings({
          linted,
          selected: request.selected,
          path: request.ports.path,
          sourceLines: request.repository.sourceLines,
          repoRoot: request.run.repoRoot,
        }),
      }),
    ),
  });
  if (findings.outcome === "failed") {
    return Promise.resolve(findings);
  }
  return trackedExceptions({
    packageScriptsAt: request.repository.packageScriptsAt,
    suppressionsAt: request.repository.suppressionsAt,
    trackedPaths: request.run.trackedPaths,
    selectedRules: selectedRulesOf({ selected: request.selected }),
    judge: scriptOptionJudge({
      query: request.query,
      eslint: request.ports.eslint,
      path: request.ports.path,
      repoRoot: request.run.repoRoot,
      checked: request.queried.checked.map((checked) => checked.file),
    }),
  }).then((tracked) => {
    if (tracked.outcome === "failed") {
      return tracked;
    }
    return {
      outcome: "ok",
      value: {
        hits: findings.value.flatMap((found) => found.hits),
        nativeExceptions: [
          ...queryExceptions({ selected: request.selected, records: request.run.records, queried: request.queried }),
          ...findings.value.flatMap((found) => found.nativeExceptions),
          ...tracked.value,
        ],
        projection: request.status.projection,
        slices: request.status.slices,
        measured: findings.value.flatMap((found) => found.measured),
      },
    };
  });
};

const lintedReport = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly status: ProjectionStatus;
  readonly ports: EslintRunnerPorts;
  readonly repository: EslintRepository;
  readonly query: QueryInstance;
  readonly queried: QueriedFiles;
}): Promise<Outcome<EslintRunReport>> =>
  governedLint({ run: request.run, selected: request.selected, eslint: request.ports.eslint }).then(
    (lintedFiles) =>
      lintedFiles.outcome === "failed" ? lintedFiles : governedReport({ ...request, lintedFiles: lintedFiles.value }),
  );

const unappliedSliceOf = (request: {
  readonly folder: RepoPath;
  readonly state: "not-applied" | "nested-configuration";
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly checked: readonly CheckedFile[];
}): readonly SliceProblem[] =>
  projectionEffect({
    selected: request.selected,
    records: recordsUnderCheck({ records: request.records, checked: request.checked }),
    queried: { ignored: [], checked: request.checked },
  }) === "not-in-effect"
    ? [{ slice: slicePathOf({ root: { placement: "package", directory: request.folder } }), state: request.state }]
    : [];

const unappliedSlicesOf = (request: {
  readonly roots: readonly ConfigRoot[];
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): readonly SliceProblem[] => {
  const packages = packageFoldersOf({ roots: request.roots });
  const checkedByPackage = Map.groupBy(request.queried.checked, (entry) => governingPackageOf({ file: entry.file, packages }));
  const fileRecordsByPackage = Map.groupBy(fileRecordsOf({ records: request.records }), (record) =>
    governingPackageOf({ file: record.file, packages }),
  );
  const clauseWide = request.records.filter((record) => record.kind === "clause-wide-carve-out");
  return request.roots.flatMap((root) =>
    root.placement === "repository"
      ? []
      : unappliedSliceOf({
          folder: root.directory,
          state: "not-applied",
          selected: request.selected,
          records: [...clauseWide, ...(fileRecordsByPackage.get(root.directory) ?? [])],
          checked: checkedByPackage.get(root.directory) ?? [],
        }),
  );
};

const nestedConfigurationSlicesOf = (request: {
  readonly folders: readonly RepoPath[];
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): readonly SliceProblem[] => {
  const clauseWide = request.records.filter((record) => record.kind === "clause-wide-carve-out");
  return request.folders.flatMap((folder) => {
    const prefix = `${folder}/`;
    return unappliedSliceOf({
      folder,
      state: "nested-configuration",
      selected: request.selected,
      records: [...clauseWide, ...fileRecordsOf({ records: request.records }).filter((record) => record.file.startsWith(prefix))],
      checked: request.queried.checked.filter((entry) => entry.file.startsWith(prefix)),
    });
  });
};

const queriedReport = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly status: ProjectionStatus;
  readonly attributedRoots: readonly ConfigRoot[];
  readonly nestedFolders: readonly RepoPath[];
  readonly ports: EslintRunnerPorts;
  readonly repository: EslintRepository;
  readonly query: QueryInstance;
  readonly queried: Outcome<QueriedFiles>;
}): Promise<Outcome<EslintRunReport>> => {
  if (request.queried.outcome === "failed") {
    return Promise.resolve(request.queried);
  }
  const queried = request.queried.value;
  const records = recordsUnderCheck({ records: request.run.records, checked: queried.checked });
  if (projectionEffect({ selected: request.selected, records, queried }) === "not-in-effect") {
    const unapplied = unappliedSlicesOf({
      roots: request.attributedRoots,
      selected: request.selected,
      records: request.run.records,
      queried,
    });
    const nested = nestedConfigurationSlicesOf({
      folders: request.nestedFolders,
      selected: request.selected,
      records: request.run.records,
      queried,
    });
    return Promise.resolve(reportWith({ projection: "not-included", slices: [...request.status.slices, ...unapplied, ...nested] }));
  }
  return lintedReport({ ...request, queried });
};

const governedRun = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly status: ProjectionStatus;
  readonly roots: readonly ConfigRoot[];
  readonly lookup: ConfigLookup;
  readonly ports: EslintRunnerPorts;
  readonly repository: EslintRepository;
}): Promise<Outcome<EslintRunReport>> => {
  const lookup = request.lookup;
  const query = request.ports.eslint.createQueryInstance(
    lookup.kind === "repository-root"
      ? { repoRoot: request.run.repoRoot, configFile: lookup.configFile }
      : { repoRoot: request.run.repoRoot },
  );
  return queriedFiles({
    query,
    files: request.run.files,
    ruleIds: ruleIdsOf({ selected: request.selected }),
    location: {
      path: request.ports.path,
      repoRoot: request.run.repoRoot,
      governingIgnoreOf: cachedGoverningIgnores({ eslint: request.ports.eslint }),
      names: VERSION_ONE_NAMES,
    },
  }).then((queried) =>
    queriedReport({
      ...request,
      attributedRoots: lookup.kind === "repository-root" ? [] : request.roots,
      nestedFolders:
        lookup.kind === "repository-root"
          ? []
          : nestedConfigurationFoldersOf({ trackedPaths: request.run.trackedPaths, files: request.run.files }),
      query,
      queried,
    }),
  );
};

const projectionStatusOf = (request: {
  readonly current: CurrentProjection;
  readonly source: SliceSource;
  readonly roots: readonly ConfigRoot[];
  readonly projectionFiles: ProjectionFiles;
}): Outcome<ProjectionStatus> => {
  const generated = sliceTextOf({ ...request.source, root: { placement: "repository" } });
  if (generated.outcome === "failed") {
    return generated;
  }
  const slices = packageSliceProblemsOf({ ...request.source, projectionFiles: request.projectionFiles, roots: request.roots });
  if (slices.outcome === "failed") {
    return slices;
  }
  const state = projectionState({ current: request.current, generated: generated.value });
  return { outcome: "ok", value: { projection: state === "current" ? "current" : "out-of-date", slices: slices.value } };
};

const selectedRun = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly origin: ImportOrigin;
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<EslintRunReport>> => {
  const repository = request.ports.repositoryAt({ repoRoot: request.run.repoRoot });
  const states = repository.projectionFiles.currentOf({ files: [PROJECTION_PATH] });
  if (states.outcome === "failed") {
    return Promise.resolve(states);
  }
  const current = projectionStateAt({ states: states.value, file: PROJECTION_PATH });
  if (current.outcome === "failed") {
    return Promise.resolve(current);
  }
  if (current.value.presence === "absent") {
    return Promise.resolve(reportWith({ projection: "missing", slices: [] }));
  }
  const lookup = repository.teamConfigLookup({ trackedPaths: request.run.trackedPaths });
  if (lookup.outcome === "failed") {
    return Promise.resolve(lookup);
  }
  const roots = configRootsOf({
    trackedPaths: request.run.trackedPaths,
    declared: request.run.declaredConfigRoots,
    lookup: lookup.value.kind,
  });
  const status = projectionStatusOf({
    current: current.value,
    source: {
      clauses: projectionClausesOf({ configured: request.selected }),
      records: request.run.records,
      origin: sliceOriginOf({ path: request.ports.path, origin: request.origin }),
    },
    roots,
    projectionFiles: repository.projectionFiles,
  });
  if (status.outcome === "failed") {
    return Promise.resolve(status);
  }
  const unprojectedFolders = unprojectedFoldersOf({
    trackedPaths: request.run.trackedPaths,
    files: request.run.files,
    lookup: lookup.value.kind,
  });
  return governedRun({
    ...request,
    repository,
    status: {
      ...status.value,
      slices: [...status.value.slices, ...unconfiguredSlicesOf({ folderConfiguration: repository.folderConfiguration, run: request.run, roots })],
    },
    roots,
    lookup: lookup.value,
  }).then((report) => (report.outcome === "failed" ? report : { outcome: "ok", value: { ...report.value, unprojectedFolders } }));
};

const importOriginOf = (request: {
  readonly ports: EslintRunnerPorts;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
}): Outcome<ImportOrigin> => {
  const install = request.ports.coreInstall({ installRoot: request.installRoot });
  return install.outcome === "failed" ? install : { outcome: "ok", value: { repoRoot: request.repoRoot, install: install.value } };
};

const projectedWrite = (request: {
  readonly request: ProjectionRequest;
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<readonly ProjectionWrite[]>> => {
  const origin = importOriginOf({
    ports: request.ports,
    repoRoot: request.request.repoRoot,
    installRoot: request.request.installRoot,
  });
  if (origin.outcome === "failed") {
    return Promise.resolve(origin);
  }
  const configured = configuredSelection({
    clauses: request.request.clauses,
    path: request.ports.path,
    origin: origin.value,
  });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  const repository = request.ports.repositoryAt({ repoRoot: request.request.repoRoot });
  const source = {
    projectionFiles: repository.projectionFiles,
    clauses: projectionClausesOf({ configured: configured.value }),
    records: request.request.records,
    origin: sliceOriginOf({ path: request.ports.path, origin: origin.value }),
  };
  return Promise.resolve(
    slicedProjectionWrites({
      ...source,
      roots: configRootsOf({
        trackedPaths: request.request.trackedPaths,
        declared: request.request.declaredConfigRoots,
        lookup: repository.configLookup({ trackedPaths: request.request.trackedPaths }),
      }),
      trackedPaths: request.request.trackedPaths,
    }),
  );
};

const ranClauses = (request: {
  readonly run: EmbeddedRunRequest;
  readonly ports: EslintRunnerPorts;
}): ReturnType<EmbeddedRunner["run"]> => {
  const origin = importOriginOf({ ports: request.ports, repoRoot: request.run.repoRoot, installRoot: request.run.installRoot });
  if (origin.outcome === "failed") {
    return Promise.resolve(origin);
  }
  return selectedClauses({
    clauses: request.run.clauses,
    path: request.ports.path,
    origin: origin.value,
    modules: request.ports.modules,
  }).then((selected) =>
    selected.outcome === "failed"
      ? selected
      : selectedRun({ run: request.run, selected: selected.value, origin: origin.value, ports: request.ports }),
  );
};

export const ESLINT_PROJECTED_KINDS: readonly NativeException["kind"][] = ["config-override", "inline-disable"];

export const eslintRunnerOver = (ports: EslintRunnerPorts): EmbeddedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: ESLINT_PROJECTED_KINDS,
  run: (request) => ranClauses({ run: request, ports }),
  conform: (request) =>
    conformedCases({
      clause: request.clause,
      cases: request.cases,
      path: ports.path,
      eslint: ports.eslint,
      loadedPlugin: ({ configured }) => loadedPlugin({ configured, modules: ports.modules }),
    }),
  project: (request) => projectedWrite({ request, ports }),
});

export const createEslintRunner = (platform: EslintPlatformPorts): EmbeddedRunner =>
  eslintRunnerOver({
    repositoryAt: ({ repoRoot }) => eslintRepositoryOver({ ...platform, repoRoot }),
    coreInstall: ({ installRoot }) => coreInstallOf({ ...platform, installRoot }),
    modules: platform.modules,
    path: platform.path,
    eslint: platform.eslint,
  });

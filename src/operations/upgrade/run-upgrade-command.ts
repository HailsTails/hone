import type { RepositoryLocated } from "../../application/ports/command/repository-located.ts";
import type { DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../../application/ports/file-system/directory-removal-port.ts";
import type { EntryKindPort } from "../../application/ports/file-system/entry-kind-port.ts";
import type { FileCreationPort } from "../../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../application/ports/file-system/file-removal-port.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type { RecordsEditor } from "../../application/ports/records/records-editor.ts";
import type { RecordsReader } from "../../application/ports/records/records-reader.ts";
import type {
  RecordsOnDiskOf,
  VersionOneRead,
  VersionOneReadOf,
} from "../../application/ports/records/version-one-reading.ts";
import type { LoadFailureDetail } from "../../application/ports/report/load-failure-detail.ts";
import type { RunSettingsOf } from "../../application/ports/selection/selection-repository.ts";
import type { ProofEffects } from "../../application/ports/upgrade/proof-effect.ts";
import type {
  ProofCarriedOver,
  ProofRefusal,
} from "../../application/ports/upgrade/proof-outcome.ts";
import type {
  CheckReportPointers,
  ProofRunsOf,
  ProofWritten,
} from "../../application/ports/upgrade/proof-runs.ts";
import type { SmoothingCommands } from "../../application/ports/upgrade/smoothing-commands.ts";
import type { UpgradeCarriedOver } from "../../application/ports/upgrade/upgrade-carried-over.ts";
import type { UpgradeStop } from "../../application/ports/upgrade/upgrade-stop.ts";
import type { MeasureVersionOneProjection } from "../../application/ports/upgrade/version-one-measurement.ts";
import type { VersionOneProjectionPortOf } from "../../application/ports/upgrade/version-one-projection-port.ts";
import type {
  ImportsRewrittenOf,
  ImportsRewriterOf,
  ItemTextOf,
  TeamRuleSetsRequest,
  VersionOneTeamLayoutsOf,
} from "../../application/ports/upgrade/version-one-team-layout.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import { type VersionTwoRun, versionTwoRunOver } from "../../application/run/version-two-run.ts";
import {
  type PlannedProjectionPorts,
  plannedProjectionOf,
} from "../../application/upgrade/command/planned-projection.ts";
import { versionOneProjectionsOfRepository } from "../../application/upgrade/command/version-one-projections.ts";
import { versionOneMentionsOf } from "../../application/upgrade/mentions/version-one-mentions.ts";
import { proofEffectsOver } from "../../application/upgrade/proof-writes/applied-effects.ts";
import type { ProofQueries } from "../../application/upgrade/proof-writes/proof-writes.ts";
import type { ProjectionFilesOf } from "../../application/upgrade/proof/upgrade-plan.ts";
import type {
  RuleSetLayoutRemoval,
  UpgradeProofRequest,
} from "../../application/upgrade/proof/upgrade-proof.ts";
import { createAnsweringOracle } from "../../application/upgrade/record-answers/answering-oracle.ts";
import { createUpgradeBefore } from "../../application/upgrade/record-answers/upgrade-before.ts";
import type { VersionOneCheckInput } from "../../application/upgrade/record-answers/version-one-check-input.ts";
import {
  type TeamLayoutPlan,
  teamLayoutPlanOf,
} from "../../application/upgrade/team-layout/team-layout-plan.ts";
import { provenWithTeamLayout } from "../../application/upgrade/team-layout/team-layout-proof.ts";
import { checkAddressOf } from "../../domain/language-layer/check-address.ts";
import type { RecordKind } from "../../domain/language-layer/symptom-catalogue.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { assessmentInEffect } from "../../domain/settings/assessment.ts";
import type { RuleSetCatalogue } from "../../domain/settings/check-choices.ts";
import type { ConsumerSelectionFile } from "../../domain/settings/selection/selection-file.ts";
import { createSmoothingCommands, type FoundTreeReach } from "./smoothing-commands.ts";

export type UpgradePorts = PlannedProjectionPorts & {
  readonly directory: DirectoryPort;
  readonly fileCreation: FileCreationPort;
  readonly fileRemoval: FileRemovalPort;
  readonly directoryRemoval: DirectoryRemovalPort;
  readonly entryKind: EntryKindPort;
  readonly loadFailureDetail: LoadFailureDetail;
  readonly versionOneProjectionOf: VersionOneProjectionPortOf;
  readonly recordsReader: RecordsReader;
  readonly recordsEditor: RecordsEditor;
};

export type UpgradeInput = {
  readonly command: Omit<VersionOneCommandPorts, "shownPathOfRepository">;
  readonly ports: UpgradePorts;
  readonly measureVersionOne: MeasureVersionOneProjection;
  readonly located: RepositoryLocated;
  readonly runSettingsOf: RunSettingsOf;
  readonly catalogues: () => Result<readonly RuleSetCatalogue[], LoadFailure>;
  readonly externalCataloguesOf: (
    request: TeamRuleSetsRequest,
  ) => Result<readonly RuleSetCatalogue[], LoadFailure>;
  readonly versionOneTeamLayoutsOf: VersionOneTeamLayoutsOf;
  readonly itemTextOf: ItemTextOf;
  readonly importsRewriterOf: ImportsRewriterOf;
  readonly recordsOnDiskOf: RecordsOnDiskOf;
  readonly versionOneReadOf: VersionOneReadOf;
  readonly proofRunsOf: ProofRunsOf;
  readonly proofOf: (
    request: UpgradeProofRequest,
  ) => Promise<Result<ProofCarriedOver, ProofRefusal>>;
  readonly foundTreeReach: (request: ProofWritten) => FoundTreeReach;
  readonly pointers: CheckReportPointers;
};

type Prepared = {
  readonly check: VersionOneCheckInput;
  readonly read: VersionOneRead;
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly trackedPaths: readonly RepoPath[];
};

const toolRecordKindsOf = (prepared: Prepared): readonly RecordKind[] =>
  prepared.catalogues.flatMap(({ ruleSet, catalogue }) =>
    ruleSet === TOOL_RULE_SET ? catalogue.recordKinds : [],
  );

const stoppedByLoad = (request: { readonly failure: LoadFailure }): Result<never, UpgradeStop> => ({
  outcome: "failed",
  error: { stopped: "load-failed", failure: request.failure },
});

const checkRequestOf = (request: UpgradeInput): Result<VersionOneCheckInput, LoadFailure> => {
  const { command } = request;
  const { repoRoot, installRoot } = request.located;
  const { fileText, path } = command;
  const moduleExtension = moduleExtensionOf({ moduleUrl: command.moduleUrl });
  const configured = request.runSettingsOf({ repoRoot });
  if (configured.outcome === "failed") {
    return configured;
  }
  return {
    outcome: "ok",
    value: {
      repoRoot,
      installRoot,
      moduleExtension,
      baseRevision: undefined,
      assessment: assessmentInEffect({
        requested: { forfeiture: undefined },
        configured: configured.value.assessment,
      }),
      fileText,
      modules: command.modules,
      path,
      git: command.git,
      selectionRepository: command.selectionRepositoryOf({
        repoRoot,
        installRoot,
        moduleExtension,
        fileText,
        path,
      }),
      exceptionRepository: command.exceptionRepositoryOf({ repoRoot }),
      exceptionEntryParser: command.exceptionEntryParser,
    },
  };
};

const preparedOf = (request: UpgradeInput): Result<Prepared, UpgradeStop> => {
  const { command, located } = request;
  const check = checkRequestOf(request);
  if (check.outcome === "failed") {
    return stoppedByLoad({ failure: check.error });
  }
  const tracked = command.git.trackedPaths({ repoRoot: located.repoRoot });
  if (tracked.outcome === "failed") {
    return stoppedByLoad({
      failure: { kind: "git-failed", detail: `${tracked.error.command}: ${tracked.error.detail}` },
    });
  }
  const catalogues = request.catalogues();
  if (catalogues.outcome === "failed") {
    return stoppedByLoad({ failure: catalogues.error });
  }
  const recordsOnDisk = request.recordsOnDiskOf({ repoRoot: located.repoRoot });
  if (recordsOnDisk.outcome === "failed") {
    return stoppedByLoad({ failure: recordsOnDisk.error });
  }
  const read = request.versionOneReadOf({
    recordsOnDisk: recordsOnDisk.value,
    repoRoot: located.repoRoot,
    selectionRepository: check.value.selectionRepository,
    exceptionRepository: check.value.exceptionRepository,
  });
  if (read.outcome === "failed") {
    return { outcome: "failed", error: { stopped: "refused", failure: read.error } };
  }
  return {
    outcome: "ok",
    value: {
      check: check.value,
      read: read.value,
      catalogues: catalogues.value,
      trackedPaths: tracked.value,
    },
  };
};

const proofQueriesOf = (request: UpgradeInput): ProofQueries => ({
  fileText: request.command.fileText,
  entryKind: request.ports.entryKind,
  path: request.command.path,
});

const proofEffectsOf = (request: UpgradeInput): ProofEffects =>
  proofEffectsOver({
    fileText: request.command.fileText,
    fileCreation: request.ports.fileCreation,
    fileRemoval: request.ports.fileRemoval,
    directory: request.ports.directory,
    directoryRemoval: request.ports.directoryRemoval,
  });

const projectionFilesFor = (request: UpgradeInput): ProjectionFilesOf =>
  plannedProjectionOf({
    command: request.command,
    repoRoot: request.located.repoRoot,
    installRoot: request.located.installRoot,
    directory: request.ports.directory,
    recordsReader: request.ports.recordsReader,
    boundCatalogueOf: request.ports.boundCatalogueOf,
    settingsFormat: request.ports.settingsFormat,
    settingsSourcesOf: request.ports.settingsSourcesOf,
    checkPieceSourceOf: request.ports.checkPieceSourceOf,
    namedEngine: request.ports.namedEngine,
  });

const versionTwoRunFor = (request: {
  readonly foundTreeReach: UpgradeInput["foundTreeReach"];
  readonly proofWritten: ProofWritten;
}): Promise<Result<VersionTwoRun, RunLoadFailure>> =>
  versionTwoRunOver({
    stages: request.foundTreeReach(request.proofWritten).stages,
    arguments: {
      forfeiture: undefined,
      reportOutput: undefined,
      measuring: "when-debt-held",
    },
  });

const createUpgradeSmoothing = (
  request: Pick<UpgradeInput, "foundTreeReach" | "located" | "ports" | "pointers">,
): SmoothingCommands =>
  createSmoothingCommands({
    reach: request.foundTreeReach,
    repoRoot: request.located.repoRoot,
    recordsReader: request.ports.recordsReader,
    recordsEditor: request.ports.recordsEditor,
    projectCommand: request.pointers.projectCommand,
  });

const proofRequestOf = (
  request: UpgradeInput & {
    readonly prepared: Prepared;
    readonly ruleSetLayout: RuleSetLayoutRemoval;
  },
): UpgradeProofRequest => {
  const { ports, command, located, prepared } = request;
  const at = {
    fileText: command.fileText,
    fileRemoval: ports.fileRemoval,
    directory: ports.directory,
    path: command.path,
    repoRoot: located.repoRoot,
    installRoot: located.installRoot,
    moduleExtension: prepared.check.moduleExtension,
    toolRecordKinds: toolRecordKindsOf(prepared),
  };
  const before = createUpgradeBefore({
    measureVersionOne: request.measureVersionOne,
    check: prepared.check,
    selection: prepared.read.reading.selection,
    catalogues: prepared.catalogues,
    engine: ports.namedEngine,
    sources: ports.settingsSourcesOf(at),
    readPiece: ports.checkPieceSourceOf(at),
    projection: ports.versionOneProjectionOf({ ...at, modules: command.modules }),
    loadFailureDetail: ports.loadFailureDetail,
  });
  return {
    queries: proofQueriesOf(request),
    effects: proofEffectsOf(request),
    oracle: createAnsweringOracle({
      enginePass: before.enginePass,
      catalogues: prepared.catalogues,
    }),
    runs: request.proofRunsOf({
      versionOne: before.report,
      versionTwo: (proofWritten) =>
        versionTwoRunFor({ foundTreeReach: request.foundTreeReach, proofWritten }),
      pointers: request.pointers,
    }),
    smoothing: createUpgradeSmoothing(request),
    reading: prepared.read.reading,
    versionOneFiles: prepared.read.versionOneFiles,
    ruleSetLayout: request.ruleSetLayout,
    catalogues: prepared.catalogues,
    repoRoot: located.repoRoot,
    trackedPaths: prepared.trackedPaths,
    projectionFilesOf: projectionFilesFor(request),
    settingsFormat: ports.settingsFormat,
    versionOneProjectionsOf: versionOneProjectionsOfRepository({
      project: () =>
        before.prepareProjections(prepared.read.reading.heads.map(({ record }) => record)),
      loadFailureDetail: ports.loadFailureDetail,
      fileText: command.fileText,
      path: command.path,
      repoRoot: located.repoRoot,
      trackedPaths: prepared.trackedPaths,
    }),
  };
};

const withMentions = (request: {
  readonly input: UpgradeInput;
  readonly prepared: Prepared;
  readonly carried: ProofCarriedOver;
}): UpgradeCarriedOver => ({
  ...request.carried,
  ...versionOneMentionsOf({
    tracked: request.prepared.trackedPaths,
    removed: request.carried.removed.files,
    repoRoot: request.input.located.repoRoot,
    fileText: request.input.command.fileText,
    path: request.input.command.path,
  }),
});

const IMPORTS_KEPT: ImportsRewrittenOf = ({ text }) => ({ outcome: "ok", value: text });

const teamLayoutPlanFor = async (
  request: UpgradeInput & { readonly prepared: Prepared },
): Promise<Result<TeamLayoutPlan, UpgradeStop>> => {
  const layouts = request.versionOneTeamLayoutsOf({
    selection: request.prepared.read.reading.selection,
    toolRecordKinds: toolRecordKindsOf(request.prepared),
  });
  if (layouts.outcome === "failed") {
    return stoppedByLoad({ failure: layouts.error });
  }
  const importsRewrittenOf: Result<ImportsRewrittenOf, LoadFailure> = layouts.value.some(
    ({ clauses }) => clauses.some(({ pieces }) => pieces.length > 0),
  )
    ? await request.importsRewriterOf()
    : { outcome: "ok", value: IMPORTS_KEPT };
  if (importsRewrittenOf.outcome === "failed") {
    return stoppedByLoad({ failure: importsRewrittenOf.error });
  }
  const plan = teamLayoutPlanOf({
    layouts: layouts.value,
    toolChecks: request.prepared.catalogues
      .filter(({ ruleSet }) => ruleSet === TOOL_RULE_SET)
      .flatMap(({ catalogue }) => catalogue.checks.map((check) => checkAddressOf({ check }))),
    itemTextOf: request.itemTextOf,
    importsRewrittenOf: importsRewrittenOf.value,
  });
  return plan.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          stopped: "refused",
          failure: { kind: "plan-refused", refusal: plan.error, removedByVersionOne: [] },
        },
      }
    : plan;
};

export const upgradeOf = async (
  request: UpgradeInput,
): Promise<Result<UpgradeCarriedOver, UpgradeStop>> => {
  const prepared = preparedOf(request);
  if (prepared.outcome === "failed") {
    return prepared;
  }
  const plan = await teamLayoutPlanFor({ ...request, prepared: prepared.value });
  if (plan.outcome === "failed") {
    return plan;
  }
  const { selection } = prepared.value.read.reading;
  const carried = await provenWithTeamLayout({
    queries: proofQueriesOf(request),
    effects: proofEffectsOf(request),
    repoRoot: request.located.repoRoot,
    plan: plan.value,
    cataloguesAfterWriting: () => {
      const external = request.externalCataloguesOf({
        selection,
        toolRecordKinds: toolRecordKindsOf(prepared.value),
      });
      return external.outcome === "failed"
        ? external
        : { outcome: "ok", value: [...prepared.value.catalogues, ...external.value] };
    },
    proofOf: (catalogues) =>
      request.proofOf(
        proofRequestOf({
          ...request,
          prepared: { ...prepared.value, catalogues },
          ruleSetLayout: { removed: plan.value.removed, folders: plan.value.folders },
        }),
      ),
  });
  return carried.outcome === "failed"
    ? carried
    : {
        outcome: "ok",
        value: withMentions({ input: request, prepared: prepared.value, carried: carried.value }),
      };
};

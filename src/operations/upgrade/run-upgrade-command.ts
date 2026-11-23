import type { RepositoryLocated } from "../../application/ports/command/repository-located.ts";
import type { DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../../application/ports/file-system/directory-removal-port.ts";
import type { EntryKindPort } from "../../application/ports/file-system/entry-kind-port.ts";
import type { FileCreationPort } from "../../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../application/ports/file-system/file-removal-port.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type {
  RecordsOnDiskOf,
  VersionOneRead,
  VersionOneReadOf,
} from "../../application/ports/records/version-one-reading.ts";
import type { LoadFailureDetail } from "../../application/ports/report/load-failure-detail.ts";
import type { RunSettingsOf } from "../../application/ports/selection/selection-repository.ts";
import type {
  ProofCarriedOver,
  ProofRefusal,
} from "../../application/ports/upgrade/proof-outcome.ts";
import type { ProofRunsOf, ProofWritten } from "../../application/ports/upgrade/proof-runs.ts";
import type { UpgradeCarriedOver } from "../../application/ports/upgrade/upgrade-carried-over.ts";
import type { UpgradeStop } from "../../application/ports/upgrade/upgrade-stop.ts";
import type { MeasureVersionOneProjection } from "../../application/ports/upgrade/version-one-measurement.ts";
import type { VersionOneProjectionPortOf } from "../../application/ports/upgrade/version-one-projection-port.ts";
import type {
  ImportsRewrittenOf,
  ItemTextOf,
  VersionOneTeamLayoutsOf,
} from "../../application/ports/upgrade/version-one-team-layout.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import { type VersionTwoStages, versionTwoRunOver } from "../../application/run/version-two-run.ts";
import {
  type PlannedProjectionPorts,
  plannedProjectionOf,
} from "../../application/upgrade/command/planned-projection.ts";
import { versionOneProjectionsOfRepository } from "../../application/upgrade/command/version-one-projections.ts";
import { versionOneMentionsOf } from "../../application/upgrade/mentions/version-one-mentions.ts";
import type { ProofWritePorts } from "../../application/upgrade/proof-writes/proof-writes.ts";
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
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { assessmentInEffect } from "../../domain/settings/assessment.ts";
import type { RuleSetCatalogue } from "../../domain/settings/check-choices.ts";
import type { ConsumerSelectionFile } from "../../domain/settings/selection/selection-file.ts";

export type UpgradePorts = PlannedProjectionPorts & {
  readonly directory: DirectoryPort;
  readonly fileCreation: FileCreationPort;
  readonly fileRemoval: FileRemovalPort;
  readonly directoryRemoval: DirectoryRemovalPort;
  readonly entryKind: EntryKindPort;
  readonly loadFailureDetail: LoadFailureDetail;
  readonly versionOneProjectionOf: VersionOneProjectionPortOf;
};

export type UpgradeInput = {
  readonly command: Omit<VersionOneCommandPorts, "shownPathOfRepository">;
  readonly ports: UpgradePorts;
  readonly measureVersionOne: MeasureVersionOneProjection;
  readonly located: RepositoryLocated;
  readonly runSettingsOf: RunSettingsOf;
  readonly catalogues: () => Result<readonly RuleSetCatalogue[], LoadFailure>;
  readonly externalCataloguesOf: (
    selection: ConsumerSelectionFile,
  ) => Result<readonly RuleSetCatalogue[], LoadFailure>;
  readonly versionOneTeamLayoutsOf: VersionOneTeamLayoutsOf;
  readonly itemTextOf: ItemTextOf;
  readonly importsRewrittenOf: ImportsRewrittenOf;
  readonly recordsOnDiskOf: RecordsOnDiskOf;
  readonly versionOneReadOf: VersionOneReadOf;
  readonly proofRunsOf: ProofRunsOf;
  readonly proofOf: (
    request: UpgradeProofRequest,
  ) => Promise<Result<ProofCarriedOver, ProofRefusal>>;
  readonly foundTreeStages: (request: ProofWritten) => VersionTwoStages;
};

type Prepared = {
  readonly check: VersionOneCheckInput;
  readonly read: VersionOneRead;
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly trackedPaths: readonly RepoPath[];
};

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

const proofWritePortsOf = (request: UpgradeInput): ProofWritePorts => ({
  fileText: request.command.fileText,
  fileCreation: request.ports.fileCreation,
  fileRemoval: request.ports.fileRemoval,
  directory: request.ports.directory,
  directoryRemoval: request.ports.directoryRemoval,
  entryKind: request.ports.entryKind,
  path: request.command.path,
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
    ports: proofWritePortsOf(request),
    oracle: createAnsweringOracle({
      enginePass: before.enginePass,
      catalogues: prepared.catalogues,
    }),
    runs: request.proofRunsOf({
      versionOne: before.report,
      versionTwo: (proofWritten) =>
        versionTwoRunOver({
          stages: request.foundTreeStages(proofWritten),
          arguments: {
            forfeiture: undefined,
            reportOutput: undefined,
            measuring: "when-debt-held",
          },
        }),
    }),
    reading: prepared.read.reading,
    versionOneFiles: prepared.read.versionOneFiles,
    ruleSetLayout: request.ruleSetLayout,
    catalogues: prepared.catalogues,
    repoRoot: located.repoRoot,
    trackedPaths: prepared.trackedPaths,
    projectionFilesOf: plannedProjectionOf({
      command,
      repoRoot: located.repoRoot,
      installRoot: located.installRoot,
      directory: ports.directory,
      recordsReader: ports.recordsReader,
      boundCatalogueOf: ports.boundCatalogueOf,
      settingsFormat: ports.settingsFormat,
      settingsSourcesOf: ports.settingsSourcesOf,
      checkPieceSourceOf: ports.checkPieceSourceOf,
      namedEngine: ports.namedEngine,
    }),
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

const teamLayoutPlanFor = (
  request: UpgradeInput & { readonly prepared: Prepared },
): Result<TeamLayoutPlan, UpgradeStop> => {
  const layouts = request.versionOneTeamLayoutsOf(request.prepared.read.reading.selection);
  if (layouts.outcome === "failed") {
    return stoppedByLoad({ failure: layouts.error });
  }
  const plan = teamLayoutPlanOf({
    layouts: layouts.value,
    toolChecks: request.prepared.catalogues
      .filter(({ ruleSet }) => ruleSet === TOOL_RULE_SET)
      .flatMap(({ catalogue }) => catalogue.checks.map((check) => checkAddressOf({ check }))),
    itemTextOf: request.itemTextOf,
    importsRewrittenOf: request.importsRewrittenOf,
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
  const plan = teamLayoutPlanFor({ ...request, prepared: prepared.value });
  if (plan.outcome === "failed") {
    return plan;
  }
  const { selection } = prepared.value.read.reading;
  const carried = await provenWithTeamLayout({
    ports: proofWritePortsOf(request),
    repoRoot: request.located.repoRoot,
    plan: plan.value,
    cataloguesAfterWriting: () => {
      const external = request.externalCataloguesOf(selection);
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

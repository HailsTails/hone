import type { CommandRequest } from "../../application/ports/command-request.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { type CheckRequest, runCheck } from "../../application/run/check/run-check.ts";
import { runProject } from "../../application/projection/run-project.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { createSelectionRepository, readRunSettings } from "../../infrastructure/disciplines-file/consumer-selection.ts";
import { type UpgradeArguments, parseUpgradeArguments } from "../../infrastructure/command-line/arguments/command-arguments.ts";
import { type CommandOutcome, loadFailureOutcome } from "../../infrastructure/command-line/outcomes/command-outcome.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import type { DirectoryRemovalPort } from "../../application/ports/file-system/directory-removal-port.ts";
import type { FileCreationPort } from "../../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../application/ports/file-system/file-removal-port.ts";
import type { EntryKindPort } from "../../application/ports/file-system/entry-kind-port.ts";
import type { RuleSetCatalogue } from "../../domain/settings/check-choices.ts";
import { type RepositoryLocated, repositoryLocatedOf, stagesOverRepository, type VersionTwoRepositoryPorts } from "../../version-two-repository.ts";
import { versionTwoRunOver } from "../../application/run/version-two-run.ts";
import { assessmentInEffect } from "../../domain/settings/assessment.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type { Result } from "../../domain/result.ts";
import { createAnsweringOracle } from "../../application/upgrade/record-answers/answering-oracle.ts";
import { createVersionOneEnginePass } from "../../infrastructure/engines/protocol/engine-run/version-one-engine-pass.ts";
import { type UpgradeProofRequest, upgradeProof } from "../../application/upgrade/proof/upgrade-proof.ts";
import { foundTreeCheckReachOf, foundTreeRunReachOf } from "../../application/upgrade/found-tree/found-tree-reach.ts";
import { plannedProjectionOf } from "../../application/upgrade/command/planned-projection.ts";
import { proofRunsOf } from "../../infrastructure/command-line/proof-runs.ts";
import { shippedCataloguesOf } from "../../infrastructure/content-files/symptom-catalogues/shipped-catalogues.ts";
import { versionOneProjectionsOfRepository } from "../../application/upgrade/command/version-one-projections.ts";
import { type UpgradeFailureOutcome, upgradeFailureOutcomeOf } from "../../infrastructure/printed-report/upgrade/upgrade-refusal-text.ts";
import { ALREADY_ON_VERSION_TWO, upgradeSuccessOutcomeOf } from "../../infrastructure/printed-report/upgrade/upgrade-success-text.ts";
import { recordsOnDiskOf } from "../../infrastructure/discipline-exceptions-folder/version-one-records-on-disk.ts";
import { versionOneReadOf } from "../../infrastructure/disciplines-file/version-one-reading.ts";
import type { VersionOneRead } from "../../application/ports/records/version-one-reading.ts";

export type UpgradePorts = VersionTwoRepositoryPorts & {
  readonly fileCreation: FileCreationPort;
  readonly fileRemoval: FileRemovalPort;
  readonly directoryRemoval: DirectoryRemovalPort;
  readonly entryKind: EntryKindPort;
};

type Located = RepositoryLocated & { readonly arguments: UpgradeArguments };

type Prepared = {
  readonly check: CheckRequest;
  readonly read: VersionOneRead;
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly trackedPaths: readonly RepoPath[];
};

type Stopped = CommandOutcome | UpgradeFailureOutcome;

const locatedOf = (request: { readonly command: VersionOneCommandRequest }): Result<Located, LoadFailure> => {
  const parsed = parseUpgradeArguments({ arguments: request.command.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const located = repositoryLocatedOf({ command: request.command, repo: parsed.value.repo });
  return located.outcome === "failed" ? located : { outcome: "ok", value: { ...located.value, arguments: parsed.value } };
};

const stoppedByLoad = (request: { readonly failure: LoadFailure }): Result<never, Stopped> => ({
  outcome: "failed",
  error: loadFailureOutcome({ failure: request.failure }),
});

const checkRequestOf = (request: { readonly command: VersionOneCommandRequest; readonly located: Located }): Result<CheckRequest, LoadFailure> => {
  const { command, located } = request;
  const { repoRoot, installRoot } = located;
  const moduleExtension = moduleExtensionOf({ moduleUrl: command.moduleUrl });
  const configured = readRunSettings({ fileText: command.fileText, path: command.path, repoRoot });
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
      assessment: assessmentInEffect({ requested: { forfeiture: undefined }, configured: configured.value.assessment }),
      fileText: command.fileText,
      modules: command.modules,
      path: command.path,
      git: command.git,
      selectionRepository: createSelectionRepository({ repoRoot, installRoot, moduleExtension, fileText: command.fileText, path: command.path }),
      exceptionRepository: command.exceptionRepositoryOf({ repoRoot }),
    },
  };
};

const preparedOf = (request: { readonly ports: UpgradePorts; readonly command: VersionOneCommandRequest; readonly located: Located }): Result<Prepared, Stopped> => {
  const { ports, command, located } = request;
  const check = checkRequestOf(request);
  if (check.outcome === "failed") {
    return stoppedByLoad({ failure: check.error });
  }
  const tracked = command.git.trackedPaths({ repoRoot: located.repoRoot });
  if (tracked.outcome === "failed") {
    return stoppedByLoad({ failure: { kind: "git-failed", detail: `${tracked.error.command}: ${tracked.error.detail}` } });
  }
  const catalogues = shippedCataloguesOf({ fileText: command.fileText, path: command.path, installRoot: located.installRoot });
  if (catalogues.outcome === "failed") {
    return stoppedByLoad({ failure: catalogues.error });
  }
  const recordsOnDisk = recordsOnDiskOf({ repoRoot: located.repoRoot, fileText: command.fileText, directory: ports.directory, path: command.path });
  if (recordsOnDisk.outcome === "failed") {
    return stoppedByLoad({ failure: recordsOnDisk.error });
  }
  const read = versionOneReadOf({
    recordsOnDisk: recordsOnDisk.value,
    repoRoot: located.repoRoot,
    fileText: command.fileText,
    path: command.path,
    selectionRepository: check.value.selectionRepository,
    exceptionRepository: check.value.exceptionRepository,
  });
  return read.outcome === "failed"
    ? { outcome: "failed", error: upgradeFailureOutcomeOf({ failure: read.error, placement: { repoRoot: located.repoRoot, path: command.path } }) }
    : { outcome: "ok", value: { check: check.value, read: read.value, catalogues: catalogues.value, trackedPaths: tracked.value } };
};

const foundTreeStagesOf = (request: { readonly ports: UpgradePorts; readonly command: VersionOneCommandRequest; readonly located: Located }) => {
  const { ports, command, located } = request;
  const found = foundTreeRunReachOf({ recordsSourceOf: ports.recordsSourceOf, command });
  return stagesOverRepository({
    ports: { ...ports, recordsSourceOf: found.recordsSourceOf },
    command: { ...command, git: found.git },
    located,
    baseRevision: found.baseRevision,
  });
};

const proofRequestOf = (request: {
  readonly ports: UpgradePorts;
  readonly command: VersionOneCommandRequest;
  readonly located: Located;
  readonly prepared: Prepared;
}): UpgradeProofRequest => {
  const { ports, command, located, prepared } = request;
  return {
    ports: {
      fileText: command.fileText,
      fileCreation: ports.fileCreation,
      fileRemoval: ports.fileRemoval,
      directory: ports.directory,
      directoryRemoval: ports.directoryRemoval,
      entryKind: ports.entryKind,
      path: command.path,
    },
    oracle: createAnsweringOracle({ enginePass: createVersionOneEnginePass({ check: prepared.check }), catalogues: prepared.catalogues }),
    runs: proofRunsOf({
      versionOne: () => runCheck({ ...prepared.check, ...foundTreeCheckReachOf({ check: prepared.check }) }),
      versionTwo: () =>
        versionTwoRunOver({
          stages: foundTreeStagesOf({ ports, command, located }),
          arguments: { forfeiture: undefined, reportOutput: undefined, measuring: "when-debt-held" },
        }),
    }),
    reading: prepared.read.reading,
    versionOneFiles: prepared.read.versionOneFiles,
    catalogues: prepared.catalogues,
    repoRoot: located.repoRoot,
    projectionFilesOf: plannedProjectionOf({ command, repoRoot: located.repoRoot, installRoot: located.installRoot }),
    versionOneProjectionsOf: versionOneProjectionsOfRepository({
      project: runProject,
      check: prepared.check,
      fileText: command.fileText,
      path: command.path,
      repoRoot: located.repoRoot,
      trackedPaths: prepared.trackedPaths,
    }),
  };
};

const provedOutcomeOf = async (request: {
  readonly ports: UpgradePorts;
  readonly command: VersionOneCommandRequest;
  readonly located: Located;
  readonly prepared: Prepared;
}): Promise<Stopped> => {
  const carried = await upgradeProof(proofRequestOf(request));
  return carried.outcome === "failed"
    ? upgradeFailureOutcomeOf({ failure: carried.error, placement: { repoRoot: request.located.repoRoot, path: request.command.path } })
    : upgradeSuccessOutcomeOf({ carried: carried.value, repoRoot: request.located.repoRoot, path: request.command.path });
};

const upgradeOutcomeOf = async (request: { readonly ports: UpgradePorts; readonly command: VersionOneCommandRequest }): Promise<Stopped> => {
  const located = locatedOf(request);
  if (located.outcome === "failed") {
    return loadFailureOutcome({ failure: located.error });
  }
  const prepared = preparedOf({ ports: request.ports, command: request.command, located: located.value });
  return prepared.outcome === "failed" ? prepared.error : provedOutcomeOf({ ...request, located: located.value, prepared: prepared.value });
};

export const upgradeCommandOf =
  (ports: UpgradePorts) =>
  async (command: VersionOneCommandRequest): Promise<void> => {
    printOutcome({ process: command.process, outcome: await upgradeOutcomeOf({ ports, command }) });
  };

export const alreadyUpgradedCommand = (command: CommandRequest): Promise<void> => {
  printOutcome({ process: command.process, outcome: ALREADY_ON_VERSION_TWO });
  return Promise.resolve();
};

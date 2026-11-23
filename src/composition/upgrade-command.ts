import type { UpgradeArguments } from "../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../application/ports/command/repository-located.ts";
import type { ProofWritten } from "../application/ports/upgrade/proof-runs.ts";
import type { UpgradeCarriedOver } from "../application/ports/upgrade/upgrade-carried-over.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import { foundTreeRunReachOf } from "../application/upgrade/found-tree/found-tree-reach.ts";
import { upgradeProof } from "../application/upgrade/proof/upgrade-proof.ts";
import { parseUpgradeArguments } from "../infrastructure/command-line/arguments/command-arguments.ts";
import { printOutcome } from "../infrastructure/command-line/outcomes/print-outcome.ts";
import { proofRunsOf } from "../infrastructure/command-line/proof-runs.ts";
import { itemTextFrom } from "../infrastructure/content-files/item-folders/item-text.ts";
import { shippedCataloguesOf } from "../infrastructure/content-files/symptom-catalogues/shipped-catalogues.ts";
import { upgradeRuleSetCataloguesOf } from "../infrastructure/content-files/symptom-catalogues/upgrade-rule-set-catalogues.ts";
import { recordsOnDiskOf } from "../infrastructure/discipline-exceptions-folder/version-one-records-on-disk.ts";
import { readRunSettings } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { versionOneReadOf } from "../infrastructure/disciplines-file/version-one-reading.ts";
import { measureVersionOneProjection } from "../infrastructure/engines/protocol/engine-run/engine-run.ts";
import {
  ALREADY_ON_VERSION_TWO,
  upgradeSuccessOutcomeOf,
} from "../infrastructure/printed-report/upgrade/upgrade-success-text.ts";
import { versionOneTeamLayoutsOf } from "../infrastructure/upgrade/team-layout/version-one-team-layout.ts";
import {
  type UpgradeInput,
  type UpgradePorts,
  upgradeOf,
} from "../operations/upgrade/run-upgrade-command.ts";
import { type CommandHandler, loadFailed, type ToolCommand } from "./composed-command.ts";
import type { ToolInvocation, ToolPorts, VersionOneToolPorts } from "./tool-ports.ts";
import {
  repositoryLocatedOf,
  stagesOverRepository,
  type VersionTwoRepositoryPorts,
} from "./version-two-repository.ts";

export type UpgradeCommandPorts = VersionOneToolPorts &
  VersionTwoRepositoryPorts &
  Pick<ToolPorts, keyof UpgradePorts | "foundTreeRecordsSourceOf">;

type Placed = {
  readonly ports: UpgradeCommandPorts;
  readonly command: ToolInvocation;
  readonly located: RepositoryLocated;
};

type Upgraded = { readonly located: RepositoryLocated; readonly carried: UpgradeCarriedOver };

export const foundTreeStagesOf = (request: Placed & ProofWritten): VersionTwoStages => {
  const { ports, command, located, written } = request;
  const found = foundTreeRunReachOf({
    written,
    recordsSourceOf: ports.recordsSourceOf,
    foundTreeRecordsSourceOf: ports.foundTreeRecordsSourceOf,
    loadFailureDetail: ports.loadFailureDetail,
    command: ports,
  });
  return stagesOverRepository({
    ports: { ...ports, recordsSourceOf: found.recordsSourceOf, git: found.git },
    moduleUrl: command.moduleUrl,
    located,
    baseRevision: found.baseRevision,
  });
};

const upgradeInputOf = (request: Placed): UpgradeInput => {
  const { ports, command, located } = request;
  const { fileText, path } = ports;
  return {
    command: { ...ports, moduleUrl: command.moduleUrl },
    ports,
    measureVersionOne: measureVersionOneProjection,
    located,
    runSettingsOf: ({ repoRoot }) => readRunSettings({ fileText, path, repoRoot }),
    catalogues: () =>
      shippedCataloguesOf({
        fileText,
        directory: ports.directory,
        path,
        installRoot: located.installRoot,
      }),
    externalCataloguesOf: (selection) =>
      upgradeRuleSetCataloguesOf({
        ...located,
        fileText,
        directory: ports.directory,
        path,
        selection,
      }),
    versionOneTeamLayoutsOf: (selection) =>
      versionOneTeamLayoutsOf({
        ...located,
        fileText,
        directory: ports.directory,
        path,
        selection,
      }),
    itemTextOf: itemTextFrom,
    recordsOnDiskOf: ({ repoRoot }) =>
      recordsOnDiskOf({ repoRoot, fileText, directory: ports.directory }),
    versionOneReadOf: (read) => versionOneReadOf({ ...read, fileText, path }),
    proofRunsOf,
    proofOf: upgradeProof,
    foundTreeStages: ({ written }) => foundTreeStagesOf({ ...request, written }),
  };
};

export const UPGRADE: ToolCommand<UpgradeArguments, Upgraded, UpgradeCommandPorts> = {
  parse: parseUpgradeArguments,
  run: async ({ command, ports, parsed }) => {
    const located = repositoryLocatedOf({
      path: ports.path,
      moduleUrl: command.moduleUrl,
      repo: parsed.repo,
    });
    if (located.outcome === "failed") {
      return loadFailed({ failure: located.error });
    }
    const upgraded = await upgradeOf(upgradeInputOf({ ports, command, located: located.value }));
    if (upgraded.outcome === "ok") {
      return { outcome: "ok", value: { located: located.value, carried: upgraded.value } };
    }
    return upgraded.error.stopped === "load-failed"
      ? loadFailed({ failure: upgraded.error.failure })
      : {
          outcome: "failed",
          error: {
            failed: "upgrade",
            failure: upgraded.error.failure,
            repoRoot: located.value.repoRoot,
          },
        };
  },
  print: ({ ports, produced }) =>
    upgradeSuccessOutcomeOf({
      carried: produced.carried,
      repoRoot: produced.located.repoRoot,
      path: ports.path,
    }),
};

export const alreadyUpgradedCommand: CommandHandler = (command) => {
  printOutcome({ process: command.process, outcome: ALREADY_ON_VERSION_TWO });
  return Promise.resolve();
};

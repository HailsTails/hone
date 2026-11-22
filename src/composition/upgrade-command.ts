import type { UpgradeArguments } from "../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../application/ports/command/repository-located.ts";
import type { ProofCarriedOver } from "../application/ports/upgrade/proof-outcome.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import { foundTreeRunReachOf } from "../application/upgrade/found-tree/found-tree-reach.ts";
import { parseUpgradeArguments } from "../infrastructure/command-line/arguments/command-arguments.ts";
import { printOutcome } from "../infrastructure/command-line/outcomes/print-outcome.ts";
import { proofRunsOf } from "../infrastructure/command-line/proof-runs.ts";
import { shippedCataloguesOf } from "../infrastructure/content-files/symptom-catalogues/shipped-catalogues.ts";
import { recordsOnDiskOf } from "../infrastructure/discipline-exceptions-folder/version-one-records-on-disk.ts";
import { versionOneReadOf } from "../infrastructure/disciplines-file/version-one-reading.ts";
import { ALREADY_ON_VERSION_TWO, upgradeSuccessOutcomeOf } from "../infrastructure/printed-report/upgrade/upgrade-success-text.ts";
import { type UpgradeInput, type UpgradePorts, upgradeOf } from "../operations/upgrade/run-upgrade-command.ts";
import { type CommandHandler, loadFailed, type ToolCommand } from "./composed-command.ts";
import type { ToolInvocation, ToolPorts, VersionOneToolPorts } from "./tool-ports.ts";
import { runSettingsOver } from "./version-one-runs.ts";
import { repositoryLocatedOf, stagesOverRepository, type VersionTwoRepositoryPorts } from "./version-two-repository.ts";

export type UpgradeCommandPorts = VersionOneToolPorts & VersionTwoRepositoryPorts & Pick<ToolPorts, keyof UpgradePorts | "foundTreeRecordsSourceOf">;

type Placed = { readonly ports: UpgradeCommandPorts; readonly command: ToolInvocation; readonly located: RepositoryLocated };

type Upgraded = { readonly located: RepositoryLocated; readonly carried: ProofCarriedOver };

const foundTreeStagesOf = (request: Placed): VersionTwoStages => {
  const { ports, command, located } = request;
  const found = foundTreeRunReachOf({
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
    located,
    runSettingsOf: runSettingsOver(ports),
    catalogues: () => shippedCataloguesOf({ fileText, directory: ports.directory, path, installRoot: located.installRoot }),
    recordsOnDiskOf: ({ repoRoot }) => recordsOnDiskOf({ repoRoot, fileText, directory: ports.directory }),
    versionOneReadOf: (read) => versionOneReadOf({ ...read, fileText, path }),
    proofRunsOf,
    foundTreeStages: () => foundTreeStagesOf(request),
  };
};

export const UPGRADE: ToolCommand<UpgradeArguments, Upgraded, UpgradeCommandPorts> = {
  parse: parseUpgradeArguments,
  run: async ({ command, ports, parsed }) => {
    const located = repositoryLocatedOf({ path: ports.path, moduleUrl: command.moduleUrl, repo: parsed.repo });
    if (located.outcome === "failed") {
      return loadFailed({ failure: located.error });
    }
    const upgraded = await upgradeOf(upgradeInputOf({ ports, command, located: located.value }));
    if (upgraded.outcome === "ok") {
      return { outcome: "ok", value: { located: located.value, carried: upgraded.value } };
    }
    return upgraded.error.stopped === "load-failed"
      ? loadFailed({ failure: upgraded.error.failure })
      : { outcome: "failed", error: { failed: "upgrade", failure: upgraded.error.failure, repoRoot: located.value.repoRoot } };
  },
  print: ({ ports, produced }) => upgradeSuccessOutcomeOf({ carried: produced.carried, repoRoot: produced.located.repoRoot, path: ports.path }),
};

export const alreadyUpgradedCommand: CommandHandler = (command) => {
  printOutcome({ process: command.process, outcome: ALREADY_ON_VERSION_TWO });
  return Promise.resolve();
};

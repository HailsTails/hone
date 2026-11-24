import type { UpgradeArguments } from "../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../application/ports/command/repository-located.ts";
import { moduleExtensionOf } from "../application/ports/host/module-extension.ts";
import type { CheckReportPointers, ProofWritten } from "../application/ports/upgrade/proof-runs.ts";
import type { UpgradeCarriedOver } from "../application/ports/upgrade/upgrade-carried-over.ts";
import { foundTreeRunReachOf } from "../application/upgrade/found-tree/found-tree-reach.ts";
import { upgradeProof } from "../application/upgrade/proof/upgrade-proof.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import type { Result } from "../domain/result.ts";
import { parseUpgradeArguments } from "../infrastructure/command-line/arguments/command-arguments.ts";
import { proofRunsOf } from "../infrastructure/command-line/proof-runs.ts";
import { itemTextFrom } from "../infrastructure/content-files/item-folders/item-text.ts";
import { shippedCataloguesOf } from "../infrastructure/content-files/symptom-catalogues/shipped-catalogues.ts";
import { upgradeRuleSetCataloguesOf } from "../infrastructure/content-files/symptom-catalogues/upgrade-rule-set-catalogues.ts";
import { recordsOnDiskOf } from "../infrastructure/discipline-exceptions-folder/version-one-records-on-disk.ts";
import { readRunSettings } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { versionOneReadOf } from "../infrastructure/disciplines-file/version-one-reading.ts";
import { createImportsRewriterOf } from "../infrastructure/engines/protocol/upgrade/load-imports-rewriter.ts";
import { upgradeSuccessOutcomeOf } from "../infrastructure/printed-report/upgrade/upgrade-success-text.ts";
import { versionOneTeamLayoutsOf } from "../infrastructure/upgrade/team-layout/version-one-team-layout.ts";
import {
  type UpgradeInput,
  type UpgradePorts,
  upgradeOf,
} from "../operations/upgrade/run-upgrade-command.ts";
import type { FoundTreeReach } from "../operations/upgrade/smoothing-commands.ts";
import { checkCommandsOf, symptomPageOf } from "./check-command.ts";
import { loadFailed, type ToolCommand } from "./composed-command.ts";
import type { ToolInvocation, ToolPorts, VersionOneToolPorts } from "./tool-ports.ts";
import {
  repositoryLocatedOf,
  stagesOverRepository,
  type VersionTwoRepositoryPorts,
} from "./version-two-repository.ts";

export type UpgradeCommandPorts = VersionOneToolPorts &
  VersionTwoRepositoryPorts &
  Pick<
    ToolPorts,
    | keyof UpgradePorts
    | "foundTreeRecordsSourceOf"
    | "measureVersionOne"
    | "childMeasuredStagesOver"
  >;

type Placed = {
  readonly ports: UpgradeCommandPorts;
  readonly command: ToolInvocation;
  readonly located: RepositoryLocated;
};

type Upgraded = { readonly located: RepositoryLocated; readonly carried: UpgradeCarriedOver };

export const createFoundTreeReach = (request: Placed & ProofWritten): FoundTreeReach => {
  const { ports, command, located, written } = request;
  const found = foundTreeRunReachOf({
    written,
    recordsSourceOf: ports.recordsSourceOf,
    foundTreeRecordsSourceOf: ports.foundTreeRecordsSourceOf,
    loadFailureDetail: ports.loadFailureDetail,
    command: ports,
  });
  return {
    stages: stagesOverRepository({
      ports: {
        ...ports,
        stagesOver: ports.childMeasuredStagesOver,
        recordsSourceOf: found.recordsSourceOf,
        git: found.git,
      },
      moduleUrl: command.moduleUrl,
      located,
      baseRevision: found.baseRevision,
    }),
    recordsSourceFor: ({ catalogue }) =>
      found.recordsSourceOf({
        fileText: ports.fileText,
        git: found.git,
        gitTree: ports.gitTree,
        directory: ports.directory,
        repoRoot: located.repoRoot,
        catalogue,
      }),
  };
};

const createPointers = (request: Placed): Result<CheckReportPointers, LoadFailure> => {
  const { ports, command, located } = request;
  const commands = checkCommandsOf({
    path: ports.path,
    moduleUrl: command.moduleUrl,
    repoRoot: located.repoRoot,
    arguments: { baseRevision: undefined, forfeiture: undefined },
  });
  return commands.outcome === "failed"
    ? commands
    : {
        outcome: "ok",
        value: { ...commands.value, symptomPage: symptomPageOf({ ports, located }) },
      };
};

const upgradeInputOf = (
  request: Placed & { readonly pointers: CheckReportPointers },
): UpgradeInput => {
  const { ports, command, located } = request;
  const { fileText, path } = ports;
  return {
    command: { ...ports, moduleUrl: command.moduleUrl },
    ports,
    measureVersionOne: ports.measureVersionOne,
    located,
    runSettingsOf: ({ repoRoot }) => readRunSettings({ fileText, path, repoRoot }),
    catalogues: () =>
      shippedCataloguesOf({
        fileText,
        directory: ports.directory,
        path,
        installRoot: located.installRoot,
      }),
    externalCataloguesOf: (teamRuleSets) =>
      upgradeRuleSetCataloguesOf({
        ...located,
        ...teamRuleSets,
        fileText,
        directory: ports.directory,
        path,
      }),
    versionOneTeamLayoutsOf: (teamRuleSets) =>
      versionOneTeamLayoutsOf({
        ...located,
        ...teamRuleSets,
        fileText,
        directory: ports.directory,
        path,
      }),
    itemTextOf: itemTextFrom,
    importsRewriterOf: createImportsRewriterOf({
      modules: ports.modules,
      path,
      installRoot: located.installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: command.moduleUrl }),
    }),
    recordsOnDiskOf: ({ repoRoot }) =>
      recordsOnDiskOf({ repoRoot, fileText, directory: ports.directory }),
    versionOneReadOf: (read) => versionOneReadOf({ ...read, fileText, path }),
    proofRunsOf,
    proofOf: upgradeProof,
    foundTreeReach: ({ written }) => createFoundTreeReach({ ...request, written }),
    pointers: request.pointers,
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
    const placed = { ports, command, located: located.value };
    const pointers = createPointers(placed);
    if (pointers.outcome === "failed") {
      return loadFailed({ failure: pointers.error });
    }
    const upgraded = await upgradeOf(upgradeInputOf({ ...placed, pointers: pointers.value }));
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

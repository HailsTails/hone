import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultGitExecutionPort } from "../../src/infrastructure/git/git-port.ts";
import { createDefaultDirectoryTreePort } from "../../src/infrastructure/node/file-system/directory-tree-port.ts";
import {
  createDefaultDirectoryPort,
  createDefaultFileRemovalPort,
  createDefaultFileTextPort,
} from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createPackageManifestPort } from "../../src/infrastructure/node/modules/package-manifest-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createDefaultExecutionPort } from "../../src/infrastructure/node/process/execution-port.ts";
import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { BUN_POLICY, createBunTargetInstallPort } from "./bun-adapter.ts";
import { createClockPort } from "./clock-adapter.ts";
import { createCommandLineArgumentsPort } from "./command-line-adapter.ts";
import { createDirectoryRemovalPort } from "./directory-removal-adapter.ts";
import {
  createBaselineCheckoutPort,
  createTargetCopyPort,
  createTargetIndexPort,
  createTargetTreePort,
} from "./git-adapter.ts";
import { createIndexRemovalPort } from "./index-removal-adapter.ts";
import { createInstalledCommandPort } from "./installed-command-adapter.ts";
import { createLockfilesPort } from "./lockfiles-adapter.ts";
import { createHoneCheckPort, createSampleExecutionPort } from "./node-adapter.ts";
import {
  createHoneDependenciesPort,
  createHonePackagePort,
  createPnpmTargetInstallPort,
  PNPM_POLICY,
} from "./pnpm-adapter.ts";
import { prepareSample } from "./prepare-sample.ts";
import { type CleanUpPhase, prepareSpeedSides } from "./prepare-speed-sides.ts";
import { createEnvironmentVariablePort, defaultRunningProcessSurface } from "./process-adapter.ts";
import { readTargetTree } from "./read-target-tree.ts";
import { removeTargetCopy } from "./remove-sample.ts";
import { runSpeedBaseline } from "./run-speed-baseline.ts";
import { runSpeedPairs } from "./run-speed-pairs.ts";
import { runSpeedSample, type SampleStages } from "./run-speed-sample.ts";
import { removeSpeedSides } from "./speed-baseline-cleanup.ts";
import type { SpeedBaselineConfiguration } from "./speed-baseline-configuration.ts";
import type { SpeedBaselinePorts } from "./speed-baseline-ports.ts";
import { createTemporaryFolderPort } from "./temporary-folder-adapter.ts";
import { timeSample } from "./time-sample.ts";
import { writeSideInstall } from "./write-side-install.ts";
import { writeSideInstalls } from "./write-side-installs.ts";
import { writeSpeedBaselineReport } from "./write-speed-baseline-report.ts";
import { writeTarballs } from "./write-tarballs.ts";

const SPEED_BASELINE_CONFIGURATION: SpeedBaselineConfiguration = {
  baselineRevision: "v2.0.0-pre.4",
  targetBaseRevision: "a4af1c897",
  allowancePercents: { coldCpu: 6, coldWall: 6, warmCpu: 7, warmWall: 5 },
  pairCount: 5,
};

const host = createDefaultProcessPort({});
const path = createDefaultPathPort({});
const git = createDefaultGitExecutionPort({});
const pnpm = {
  node: createDefaultExecutionPort({ policy: PNPM_POLICY }),
  environment: createEnvironmentVariablePort({ processSurface: defaultRunningProcessSurface }),
};
const directories = createDefaultDirectoryPort({});
const honeRoot = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", ".."] }),
);

const ports: SpeedBaselinePorts = {
  arguments: createCommandLineArgumentsPort({ arguments: host.arguments, path }),
  checkouts: createBaselineCheckoutPort({ git, path, repository: honeRoot }),
  dependencies: createHoneDependenciesPort(pnpm),
  packages: createHonePackagePort({ ...pnpm, path }),
  copies: createTargetCopyPort({ git, path }),
  indexes: createTargetIndexPort({ git, path }),
  indexRemovals: createIndexRemovalPort({ files: createDefaultFileRemovalPort({}) }),
  trees: createTargetTreePort({ git, createGit: createDefaultGitExecutionPort }),
  lockfiles: createLockfilesPort({ directories }),
  installers: {
    bun: createBunTargetInstallPort({ bun: createDefaultExecutionPort({ policy: BUN_POLICY }) }),
    pnpm: createPnpmTargetInstallPort(pnpm),
  },
  installedCommands: createInstalledCommandPort({ path, fileText: createDefaultFileTextPort({}) }),
  temporaryFolders: createTemporaryFolderPort({ path, directories }),
  directories: createDirectoryRemovalPort({ tree: createDefaultDirectoryTreePort({}) }),
  resolutions: createPackageManifestPort({ path }),
  checks: createHoneCheckPort({
    createExecution: createSampleExecutionPort,
    cpuTimeReportUrl: new URL("./cpu-time-report.ts", import.meta.url).href,
  }),
  clock: createClockPort(),
};

const sampleStages: SampleStages = {
  prepareSample: (request) => prepareSample({ ...request, ports }),
  timeSample: (request) => timeSample({ ...request, ports }),
  removeSample: (request) => removeTargetCopy({ ...request, ports }),
};

const cleanUp: CleanUpPhase = (request) => removeSpeedSides({ ...request, ports });

writeSpeedBaselineReport({
  process: host,
  outcome: runSpeedBaseline({
    ports,
    phases: {
      prepare: (request) =>
        prepareSpeedSides({
          ...request,
          headRoot: honeRoot,
          stages: {
            readTargetTree: (target) => readTargetTree({ ...target, ports }),
            writeTarballs: (tarballs) => writeTarballs({ ...tarballs, ports }),
            writeSideInstalls: (installs) =>
              writeSideInstalls({
                ...installs,
                writeSideInstall: (side) => writeSideInstall({ ...side, ports }),
              }),
            cleanUp,
          },
        }),
      measure: (request) =>
        runSpeedPairs({
          installs: request.installs,
          pairCount: request.pairCount,
          runSample: (sample) =>
            runSpeedSample({
              ...sample,
              stages: sampleStages,
              repo: request.repo,
              tree: request.tree,
              baseRevision: request.baseRevision,
            }),
        }),
      cleanUp,
    },
    configuration: SPEED_BASELINE_CONFIGURATION,
  }),
});

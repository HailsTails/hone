import type { PackageManifestPort } from "../../src/application/ports/host/package-manifest-port.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import { TOOL_IDENTITY } from "../../src/domain/rule-set/tool-identity.ts";
import type { InstalledCommandPort } from "./installed-command-port.ts";
import type { LockfilesPort } from "./lockfiles-port.ts";
import type { PreparationFailure, PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SpeedSide } from "./speed-samples.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";
import type { TargetInstallPort } from "./target-install-port.ts";
import {
  mapFilesToTargetPackageManager,
  type TargetPackageManager,
} from "./target-package-manager.ts";
import type { TargetTreePort } from "./target-tree-port.ts";

export type SideInstall = {
  readonly directory: AbsolutePath;
  readonly command: AbsolutePath;
  readonly resolvedHone: string;
};

export type SideInstallRun = {
  readonly directories: readonly AbsolutePath[];
  readonly install: Result<SideInstall, PreparationRefusal>;
};

type InstallPorts = {
  readonly copies: Pick<TargetCopyPort, "read" | "write">;
  readonly trees: Pick<TargetTreePort, "write">;
  readonly lockfiles: LockfilesPort;
  readonly installers: Readonly<Record<TargetPackageManager, TargetInstallPort>>;
  readonly installedCommands: InstalledCommandPort;
  readonly resolutions: PackageManifestPort;
};

const writeInstalledHone = (request: {
  readonly ports: InstallPorts;
  readonly directory: AbsolutePath;
  readonly tarball: AbsolutePath;
}): Result<null, PreparationFailure> => {
  const files = request.ports.lockfiles.read({ directory: request.directory });
  if (files.outcome === "failed") return files;
  const manager = mapFilesToTargetPackageManager({ files: files.value });
  if (manager.outcome === "failed") return manager;
  const installed = request.ports.installers[manager.value].write({
    directory: request.directory,
    tarball: request.tarball,
  });
  return installed.outcome === "failed" ? installed : { outcome: "ok", value: null };
};

const writeInstall = (request: {
  readonly ports: InstallPorts;
  readonly directory: AbsolutePath;
  readonly tarball: AbsolutePath;
  readonly tree: string;
}): Result<SideInstall, PreparationFailure> => {
  const written = request.ports.trees.write({ copy: request.directory, tree: request.tree });
  if (written.outcome === "failed") return written;
  const installed = writeInstalledHone(request);
  if (installed.outcome === "failed") return installed;
  const resolvedHone = request.ports.resolutions.locateManifestFrom({
    packageName: TOOL_IDENTITY.packageName,
    folder: request.directory,
  });
  if (resolvedHone.outcome === "failed") return resolvedHone;
  const command = request.ports.installedCommands.read({ manifest: resolvedHone.value });
  return command.outcome === "failed"
    ? command
    : {
        outcome: "ok",
        value: {
          directory: request.directory,
          command: command.value,
          resolvedHone: resolvedHone.value,
        },
      };
};

export const writeSideInstall = (request: {
  readonly ports: InstallPorts;
  readonly repo: AbsolutePath;
  readonly side: SpeedSide;
  readonly tarball: AbsolutePath;
  readonly tree: string;
}): SideInstallRun => {
  const directory = request.ports.copies.read({
    repo: request.repo,
    place: { kind: "install", side: request.side },
  });
  if (directory.outcome === "failed") {
    return {
      directories: [],
      install: { outcome: "failed", error: { side: request.side, failure: directory.error } },
    };
  }
  const copied = request.ports.copies.write({ repo: request.repo, directory: directory.value });
  if (copied.outcome === "failed") {
    return {
      directories: [],
      install: { outcome: "failed", error: { side: request.side, failure: copied.error } },
    };
  }
  const install = writeInstall({ ...request, directory: directory.value });
  return {
    directories: [directory.value],
    install:
      install.outcome === "failed"
        ? { outcome: "failed", error: { side: request.side, failure: install.error } }
        : install,
  };
};

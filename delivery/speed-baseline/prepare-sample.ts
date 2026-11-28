import type { PackageManifestPort } from "../../src/application/ports/host/package-manifest-port.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import { TOOL_IDENTITY } from "../../src/domain/rule-set/tool-identity.ts";
import type { ClockPort } from "./clock-port.ts";
import { mapResolvedHoneToInstallCheck } from "./hone-install-check.ts";
import type { PreparationFailure, PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SpeedSide } from "./speed-samples.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";
import type { TargetTreePort } from "./target-tree-port.ts";
import type { TemporaryFolderPort } from "./temporary-folder-port.ts";
import type { SideInstall } from "./write-side-install.ts";

export type PreparedSample =
  | { readonly kind: "unplaced"; readonly refusal: PreparationRefusal }
  | {
      readonly kind: "unprepared";
      readonly copy: AbsolutePath;
      readonly refusal: PreparationRefusal;
    }
  | {
      readonly kind: "prepared";
      readonly copy: AbsolutePath;
      readonly temporaryFolder: AbsolutePath;
      readonly setUpMilliseconds: number;
    };

type PreparePorts = {
  readonly copies: Pick<TargetCopyPort, "read" | "write">;
  readonly trees: Pick<TargetTreePort, "write">;
  readonly resolutions: PackageManifestPort;
  readonly temporaryFolders: TemporaryFolderPort;
  readonly clock: ClockPort;
};

const writeSampleContents = (request: {
  readonly ports: PreparePorts;
  readonly copy: AbsolutePath;
  readonly install: SideInstall;
  readonly tree: string;
}): Result<AbsolutePath, PreparationFailure> => {
  const written = request.ports.trees.write({ copy: request.copy, tree: request.tree });
  if (written.outcome === "failed") return written;
  const resolved = request.ports.resolutions.locateManifestFrom({
    packageName: TOOL_IDENTITY.packageName,
    folder: request.copy,
  });
  if (resolved.outcome === "failed") return resolved;
  const inside = mapResolvedHoneToInstallCheck({
    sampleResolved: resolved.value,
    installResolved: request.install.resolvedHone,
    install: request.install.directory,
  });
  return inside.outcome === "failed"
    ? inside
    : request.ports.temporaryFolders.write({ place: "sample", copy: request.copy });
};

export const prepareSample = (request: {
  readonly ports: PreparePorts;
  readonly repo: AbsolutePath;
  readonly side: SpeedSide;
  readonly sampleIndex: number;
  readonly install: SideInstall;
  readonly tree: string;
}): PreparedSample => {
  const { side } = request;
  const copy = request.ports.copies.read({
    repo: request.repo,
    place: { kind: "sample", side, sampleIndex: request.sampleIndex },
  });
  if (copy.outcome === "failed") {
    return { kind: "unplaced", refusal: { side, failure: copy.error } };
  }
  const started = request.ports.clock.read();
  const copied = request.ports.copies.write({ repo: request.repo, directory: copy.value });
  if (copied.outcome === "failed") {
    return { kind: "unplaced", refusal: { side, failure: copied.error } };
  }
  const temporaryFolder = writeSampleContents({ ...request, copy: copy.value });
  const setUpMilliseconds = request.ports.clock.read() - started;
  return temporaryFolder.outcome === "failed"
    ? { kind: "unprepared", copy: copy.value, refusal: { side, failure: temporaryFolder.error } }
    : {
        kind: "prepared",
        copy: copy.value,
        temporaryFolder: temporaryFolder.value,
        setUpMilliseconds,
      };
};

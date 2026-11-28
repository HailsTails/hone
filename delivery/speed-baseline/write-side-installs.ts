import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SpeedSide } from "./speed-samples.ts";
import type { SideInstall, SideInstallRun } from "./write-side-install.ts";

export type SideInstalls = {
  readonly directories: readonly AbsolutePath[];
  readonly installs: Result<Readonly<Record<SpeedSide, SideInstall>>, PreparationRefusal>;
};

export type WriteSideInstallStage = (request: {
  readonly repo: AbsolutePath;
  readonly side: SpeedSide;
  readonly tarball: AbsolutePath;
  readonly tree: string;
}) => SideInstallRun;

export const writeSideInstalls = (request: {
  readonly writeSideInstall: WriteSideInstallStage;
  readonly repo: AbsolutePath;
  readonly tarballs: Readonly<Record<SpeedSide, AbsolutePath>>;
  readonly tree: string;
}): SideInstalls => {
  const { repo, tree } = request;
  const baseline = request.writeSideInstall({
    repo,
    side: "baseline",
    tarball: request.tarballs.baseline,
    tree,
  });
  if (baseline.install.outcome === "failed") {
    return { directories: baseline.directories, installs: baseline.install };
  }
  const head = request.writeSideInstall({
    repo,
    side: "head",
    tarball: request.tarballs.head,
    tree,
  });
  return {
    directories: [...baseline.directories, ...head.directories],
    installs:
      head.install.outcome === "failed"
        ? head.install
        : { outcome: "ok", value: { baseline: baseline.install.value, head: head.install.value } },
  };
};

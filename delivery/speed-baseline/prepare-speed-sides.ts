import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { TargetTree } from "./read-target-tree.ts";
import type { SpeedBaselineMode } from "./speed-baseline-arguments-port.ts";
import type { Leftover, PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SpeedSide } from "./speed-samples.ts";
import type { SideInstall } from "./write-side-install.ts";
import type { SideInstalls } from "./write-side-installs.ts";
import type { Tarballs } from "./write-tarballs.ts";

export type SpeedSidesMade = {
  readonly installs: readonly AbsolutePath[];
  readonly checkouts: readonly AbsolutePath[];
};

export type CleanUpPhase = (
  request: SpeedSidesMade & { readonly repo: AbsolutePath },
) => readonly Leftover[];

export type PrepareStages = {
  readonly readTargetTree: (request: { readonly repo: AbsolutePath }) => TargetTree;
  readonly writeTarballs: (request: {
    readonly revision: string;
    readonly headRoot: AbsolutePath;
    readonly mode: SpeedBaselineMode;
  }) => Tarballs;
  readonly writeSideInstalls: (request: {
    readonly repo: AbsolutePath;
    readonly tarballs: Readonly<Record<SpeedSide, AbsolutePath>>;
    readonly tree: string;
  }) => SideInstalls;
  readonly cleanUp: CleanUpPhase;
};

export type PreparedSides = {
  readonly installs: Readonly<Record<SpeedSide, SideInstall>>;
  readonly tree: string;
  readonly made: SpeedSidesMade;
};

export type SpeedSidesPreparation = {
  readonly prepared: Result<PreparedSides, PreparationRefusal>;
  readonly leftovers: readonly Leftover[];
};

type PrepareRequest = {
  readonly stages: PrepareStages;
  readonly repo: AbsolutePath;
  readonly mode: SpeedBaselineMode;
  readonly revision: string;
  readonly headRoot: AbsolutePath;
};

const installSides = (
  request: PrepareRequest & { readonly tree: string },
): SpeedSidesPreparation => {
  const { stages, repo } = request;
  const written = stages.writeTarballs({
    revision: request.revision,
    headRoot: request.headRoot,
    mode: request.mode,
  });
  if (written.tarballs.outcome === "failed") {
    const leftovers = stages.cleanUp({ repo, installs: [], checkouts: written.checkouts });
    return { prepared: { outcome: "failed", error: written.tarballs.error }, leftovers };
  }
  const installed = stages.writeSideInstalls({
    repo,
    tarballs: written.tarballs.value,
    tree: request.tree,
  });
  const made = { installs: installed.directories, checkouts: written.checkouts };
  return installed.installs.outcome === "failed"
    ? {
        prepared: { outcome: "failed", error: installed.installs.error },
        leftovers: stages.cleanUp({ repo, ...made }),
      }
    : {
        prepared: {
          outcome: "ok",
          value: { installs: installed.installs.value, tree: request.tree, made },
        },
        leftovers: [],
      };
};

export const prepareSpeedSides = (request: PrepareRequest): SpeedSidesPreparation => {
  const { stages, repo } = request;
  const target = stages.readTargetTree({ repo });
  if (target.tree.outcome === "failed") {
    return { prepared: target.tree, leftovers: target.leftovers };
  }
  const installed = installSides({ ...request, tree: target.tree.value });
  return { ...installed, leftovers: [...target.leftovers, ...installed.leftovers] };
};

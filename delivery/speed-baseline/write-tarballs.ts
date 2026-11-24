import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { SpeedBaselineMode } from "./speed-baseline-arguments-port.ts";
import type { PreparationFailure, PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SpeedBaselinePorts } from "./speed-baseline-ports.ts";
import type { SpeedSide } from "./speed-samples.ts";

export type Tarballs = {
  readonly checkouts: readonly AbsolutePath[];
  readonly tarballs: Result<Readonly<Record<SpeedSide, AbsolutePath>>, PreparationRefusal>;
};

type TarballPorts = Pick<SpeedBaselinePorts, "checkouts" | "dependencies" | "packages">;

const writePackedCheckout = (request: {
  readonly ports: TarballPorts;
  readonly revision: string;
  readonly directory: AbsolutePath;
}): Result<AbsolutePath, PreparationFailure> => {
  const checkedOut = request.ports.checkouts.write({
    revision: request.revision,
    directory: request.directory,
  });
  if (checkedOut.outcome === "failed") return checkedOut;
  const installed = request.ports.dependencies.write({ honeRoot: request.directory });
  return installed.outcome === "failed"
    ? installed
    : request.ports.packages.write({ honeRoot: request.directory });
};

const writeBaselineTarball = (request: {
  readonly ports: TarballPorts;
  readonly revision: string;
}): {
  readonly checkouts: readonly AbsolutePath[];
  readonly tarball: Result<AbsolutePath, PreparationRefusal>;
} => {
  const directory = request.ports.checkouts.read({ revision: request.revision });
  if (directory.outcome === "failed") {
    return {
      checkouts: [],
      tarball: { outcome: "failed", error: { side: "baseline", failure: directory.error } },
    };
  }
  const tarball = writePackedCheckout({ ...request, directory: directory.value });
  return {
    checkouts: [directory.value],
    tarball:
      tarball.outcome === "failed"
        ? { outcome: "failed", error: { side: "baseline", failure: tarball.error } }
        : tarball,
  };
};

export const writeTarballs = (request: {
  readonly ports: TarballPorts;
  readonly revision: string;
  readonly headRoot: AbsolutePath;
  readonly mode: SpeedBaselineMode;
}): Tarballs => {
  const baseline = writeBaselineTarball(request);
  if (baseline.tarball.outcome === "failed") {
    return { checkouts: baseline.checkouts, tarballs: baseline.tarball };
  }
  const head =
    request.mode === "calibrate"
      ? baseline.tarball
      : request.ports.packages.write({ honeRoot: request.headRoot });
  return {
    checkouts: baseline.checkouts,
    tarballs:
      head.outcome === "failed"
        ? { outcome: "failed", error: { side: "head", failure: head.error } }
        : { outcome: "ok", value: { baseline: baseline.tarball.value, head: head.value } },
  };
};

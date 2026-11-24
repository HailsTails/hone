import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import { removeTargetCopy } from "./remove-sample.ts";
import type { Leftover, PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SpeedBaselinePorts } from "./speed-baseline-ports.ts";
import type { SpeedSide } from "./speed-samples.ts";

type CleanupPorts = Pick<SpeedBaselinePorts, "copies" | "checkouts" | "directories">;

const SIDES: readonly SpeedSide[] = ["baseline", "head"];

const removeCheckout = (request: {
  readonly ports: CleanupPorts;
  readonly checkout: AbsolutePath;
}): readonly Leftover[] => {
  const unregistered = request.ports.checkouts.remove({ directory: request.checkout });
  const removed = request.ports.directories.remove({ directory: request.checkout });
  return [
    ...(unregistered.outcome === "failed" ? [unregistered.error] : []),
    ...(removed.outcome === "failed" ? [removed.error] : []),
  ];
};

const removeLeftoverInstalls = (request: {
  readonly ports: CleanupPorts;
  readonly repo: AbsolutePath;
  readonly sides: readonly SpeedSide[];
}): Result<null, PreparationRefusal> => {
  const [side, ...rest] = request.sides;
  if (side === undefined) return { outcome: "ok", value: null };
  const copy = request.ports.copies.read({ repo: request.repo, place: { kind: "install", side } });
  if (copy.outcome === "failed") return { outcome: "failed", error: { side, failure: copy.error } };
  const [leftover] = removeTargetCopy({ ...request, copy: copy.value });
  return leftover === undefined
    ? removeLeftoverInstalls({ ...request, sides: rest })
    : { outcome: "failed", error: { side, failure: leftover } };
};

export const removeSpeedLeftovers = (request: {
  readonly ports: CleanupPorts;
  readonly repo: AbsolutePath;
  readonly revision: string;
}): Result<null, PreparationRefusal> => {
  const installs = removeLeftoverInstalls({ ...request, sides: SIDES });
  if (installs.outcome === "failed") return installs;
  const checkout = request.ports.checkouts.read({ revision: request.revision });
  if (checkout.outcome === "failed") {
    return { outcome: "failed", error: { side: "baseline", failure: checkout.error } };
  }
  const [leftover] = removeCheckout({ ...request, checkout: checkout.value });
  return leftover === undefined
    ? { outcome: "ok", value: null }
    : { outcome: "failed", error: { side: "baseline", failure: leftover } };
};

export const removeSpeedSides = (request: {
  readonly ports: CleanupPorts;
  readonly repo: AbsolutePath;
  readonly installs: readonly AbsolutePath[];
  readonly checkouts: readonly AbsolutePath[];
}): readonly Leftover[] => [
  ...request.installs.toReversed().flatMap((copy) => removeTargetCopy({ ...request, copy })),
  ...request.checkouts.flatMap((checkout) => removeCheckout({ ...request, checkout })),
];

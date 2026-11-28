import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { BaselineCheckoutPort } from "./baseline-checkout-port.ts";
import type { DirectoryRemovalPort } from "./directory-removal-port.ts";
import { removeTargetCopy } from "./remove-sample.ts";
import type { Leftover } from "./speed-baseline-outcome.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";

type CleanupPorts = {
  readonly copies: Pick<TargetCopyPort, "remove">;
  readonly checkouts: Pick<BaselineCheckoutPort, "remove">;
  readonly directories: DirectoryRemovalPort;
};

const removeCheckout = (request: {
  readonly ports: CleanupPorts;
  readonly checkout: AbsolutePath;
}): readonly Leftover[] => {
  const unregistered = request.ports.checkouts.remove({ directory: request.checkout });
  if (unregistered.outcome === "failed") return [unregistered.error];
  const removed = request.ports.directories.remove({ directory: request.checkout });
  return removed.outcome === "failed" ? [removed.error] : [];
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

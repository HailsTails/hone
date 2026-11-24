import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Leftover } from "./speed-baseline-outcome.ts";
import type { SpeedBaselinePorts } from "./speed-baseline-ports.ts";

export const removeTargetCopy = (request: {
  readonly ports: Pick<SpeedBaselinePorts, "copies" | "directories">;
  readonly repo: AbsolutePath;
  readonly copy: AbsolutePath;
}): readonly Leftover[] => {
  const unregistered = request.ports.copies.remove({ repo: request.repo, directory: request.copy });
  const removed = request.ports.directories.remove({ directory: request.copy });
  return [
    ...(unregistered.outcome === "failed" ? [unregistered.error] : []),
    ...(removed.outcome === "failed" ? [removed.error] : []),
  ];
};

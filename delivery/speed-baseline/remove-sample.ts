import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { DirectoryRemovalPort } from "./directory-removal-port.ts";
import type { Leftover } from "./speed-baseline-outcome.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";

export const removeTargetCopy = (request: {
  readonly ports: {
    readonly copies: Pick<TargetCopyPort, "remove">;
    readonly directories: DirectoryRemovalPort;
  };
  readonly repo: AbsolutePath;
  readonly copy: AbsolutePath;
}): readonly Leftover[] => {
  const unregistered = request.ports.copies.remove({ repo: request.repo, directory: request.copy });
  if (unregistered.outcome === "failed") return [unregistered.error];
  const removed = request.ports.directories.remove({ directory: request.copy });
  return removed.outcome === "failed" ? [removed.error] : [];
};

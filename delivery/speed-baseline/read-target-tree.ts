import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { Leftover, PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SpeedBaselinePorts } from "./speed-baseline-ports.ts";
import type { TargetTreePort } from "./target-tree-port.ts";

export type TargetTree = {
  readonly tree: Result<string, PreparationRefusal>;
  readonly leftovers: readonly Leftover[];
};

export const readTargetTree = (request: {
  readonly ports: Pick<SpeedBaselinePorts, "createIndexDirectory" | "directories"> & {
    readonly trees: Pick<TargetTreePort, "read">;
  };
  readonly repo: AbsolutePath;
}): TargetTree => {
  const { ports, repo } = request;
  const directory = ports.createIndexDirectory({ outside: repo });
  if (directory.outcome === "failed") {
    return {
      tree: { outcome: "failed", error: { side: "target", failure: directory.error } },
      leftovers: [],
    };
  }
  const tree = ports.trees.read({ repo, indexDirectory: directory.value });
  const removed = ports.directories.remove({ directory: directory.value });
  return {
    tree:
      tree.outcome === "failed"
        ? { outcome: "failed", error: { side: "target", failure: tree.error } }
        : tree,
    leftovers: removed.outcome === "failed" ? [removed.error] : [],
  };
};

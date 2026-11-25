import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { Leftover, PreparationRefusal } from "./speed-baseline-outcome.ts";
import type { SpeedBaselinePorts } from "./speed-baseline-ports.ts";

export type TargetTree = {
  readonly tree: Result<string, PreparationRefusal>;
  readonly leftovers: readonly Leftover[];
};

export const readTargetTree = (request: {
  readonly ports: Pick<SpeedBaselinePorts, "indexes" | "trees" | "indexRemovals">;
  readonly repo: AbsolutePath;
}): TargetTree => {
  const index = request.ports.indexes.read({ repo: request.repo });
  if (index.outcome === "failed") {
    return {
      tree: { outcome: "failed", error: { side: "target", failure: index.error } },
      leftovers: [],
    };
  }
  const tree = request.ports.trees.read({ repo: request.repo, index: index.value });
  const removed = request.ports.indexRemovals.remove({ index: index.value });
  return {
    tree:
      tree.outcome === "failed"
        ? { outcome: "failed", error: { side: "target", failure: tree.error } }
        : tree,
    leftovers: removed.outcome === "failed" ? [removed.error] : [],
  };
};

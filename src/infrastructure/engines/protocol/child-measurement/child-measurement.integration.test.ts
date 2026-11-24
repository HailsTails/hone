import { describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { createDefaultChildEnginesStage } from "./child-measurement.ts";

describe("createDefaultChildEnginesStage", () => {
  it("runs the measurement entry in this Node, which reports the absent repository's load failure", async () => {
    const installRoot = absolutePathSchema.parse(`${import.meta.dirname}/../../../../..`);
    const engines = createDefaultChildEnginesStage({
      path: createDefaultPathPort({}),
      installRoot,
      repoRoot: absolutePathSchema.parse("/absent-repository"),
      moduleExtension: ".ts",
      baseRevision: undefined,
    });

    const runs = await engines({ tree: { tracked: [], declaredConfigRoots: [] } });

    expect(runs).toEqual({
      outcome: "failed",
      error: { kind: "config-absent", repo: "/absent-repository" },
    });
  });
});

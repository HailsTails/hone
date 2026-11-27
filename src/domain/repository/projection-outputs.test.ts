import { describe, expect, it } from "vitest";

import { excludeProjectionOutputs } from "./projection-outputs.ts";
import { repoPathOf } from "./repo-path-of.ts";

describe("excludeProjectionOutputs", () => {
  it("excludes exact projected paths and keeps same-name files outside selected roots", () => {
    const files = excludeProjectionOutputs({
      files: [
        repoPathOf("hone.eslint.ts"),
        repoPathOf("src/hone.eslint.ts"),
        repoPathOf("src/main.ts"),
      ],
      outputs: new Set([repoPathOf("hone.eslint.ts")]),
    });

    expect(files).toEqual(["src/hone.eslint.ts", "src/main.ts"]);
  });
});

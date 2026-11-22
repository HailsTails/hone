import { describe, expect, it } from "vitest";

import { repoArgumentOf } from "./repo-argument.ts";

describe("repoArgumentOf", () => {
  it("gives the word after --repo, whatever else the command line holds", () => {
    expect(
      repoArgumentOf({
        arguments: [
          "--base-revision",
          "origin/main",
          "--repo",
          "/work/shop",
          "--report-output",
          "counts",
        ],
      }),
    ).toBe("/work/shop");
  });

  it("gives nothing when the command line holds no --repo", () => {
    expect(repoArgumentOf({ arguments: ["--base-revision", "origin/main"] })).toBeUndefined();
  });

  it("gives nothing when --repo is the last word", () => {
    expect(repoArgumentOf({ arguments: ["--repo"] })).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import type { RepoPath } from "./repo-path-types.ts";
import { type Exclusion, exclusionOf } from "./exclusion.ts";
import { repoPathOf } from "./repo-path-of.ts";

const VENDORED = repoPathOf("src/vendored");

describe("exclusionOf", () => {
  it.each<{ readonly name: string; readonly path: RepoPath; readonly exclusion: Exclusion }>([
    { name: "the excluded path itself", path: repoPathOf("src/vendored"), exclusion: "excluded" },
    { name: "a file inside the excluded folder", path: repoPathOf("src/vendored/basket.ts"), exclusion: "excluded" },
    { name: "a file in a folder nested in the excluded folder", path: repoPathOf("src/vendored/prices/total.ts"), exclusion: "excluded" },
    { name: "a file in a sibling folder sharing the excluded folder's name as a prefix", path: repoPathOf("src/vendored-copy/basket.ts"), exclusion: "checked" },
    { name: "a file outside the excluded folder", path: repoPathOf("src/basket.ts"), exclusion: "checked" },
  ])("judges $name $exclusion", ({ path, exclusion }) => {
    expect(exclusionOf({ path, excluded: [VENDORED] })).toBe(exclusion);
  });

  it("checks every path when nothing is excluded", () => {
    expect(exclusionOf({ path: repoPathOf("src/basket.ts"), excluded: [] })).toBe("checked");
  });
});

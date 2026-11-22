import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { type Exclusion, exclusionOf } from "./exclusion.ts";

const VENDORED = repoPathSchema.parse("src/vendored");

describe("exclusionOf", () => {
  it.each<{ readonly name: string; readonly path: string; readonly exclusion: Exclusion }>([
    { name: "the excluded path itself", path: "src/vendored", exclusion: "excluded" },
    { name: "a file inside the excluded folder", path: "src/vendored/basket.ts", exclusion: "excluded" },
    { name: "a file in a folder nested in the excluded folder", path: "src/vendored/prices/total.ts", exclusion: "excluded" },
    { name: "a file in a sibling folder sharing the excluded folder's name as a prefix", path: "src/vendored-copy/basket.ts", exclusion: "checked" },
    { name: "a file outside the excluded folder", path: "src/basket.ts", exclusion: "checked" },
  ])("judges $name $exclusion", ({ path, exclusion }) => {
    expect(exclusionOf({ path: repoPathSchema.parse(path), excluded: [VENDORED] })).toBe(exclusion);
  });

  it("checks every path when nothing is excluded", () => {
    expect(exclusionOf({ path: repoPathSchema.parse("src/basket.ts"), excluded: [] })).toBe("checked");
  });
});

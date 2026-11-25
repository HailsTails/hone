import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { mapFileToFolder } from "./file-folder.ts";

describe("mapFileToFolder", () => {
  it("names the folder a file sits in", () => {
    const file = repoPathOf("packages/a/hone.eslint.mjs");

    const folder = mapFileToFolder({ file });

    expect(folder).toBe("packages/a");
  });

  it("names the repository root with an empty folder", () => {
    const file = repoPathOf("hone.eslint.mjs");

    const folder = mapFileToFolder({ file });

    expect(folder).toBe("");
  });
});

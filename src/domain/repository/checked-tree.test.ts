import { describe, expect, it } from "vitest";

import { typescriptFilesOf } from "./checked-tree.ts";
import { repoPathOf } from "./repo-path-of.ts";

describe("typescriptFilesOf", () => {
  it("gives the tracked files with a TypeScript extension, and no other", () => {
    expect(
      typescriptFilesOf({
        tracked: [
          repoPathOf("src/a.ts"),
          repoPathOf("src/b.tsx"),
          repoPathOf("src/c.mts"),
          repoPathOf("src/d.cts"),
          repoPathOf("src/e.js"),
          repoPathOf("README.md"),
        ],
      }),
    ).toEqual(["src/a.ts", "src/b.tsx", "src/c.mts", "src/d.cts"]);
  });
});

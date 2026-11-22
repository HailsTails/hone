import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { directoryOf, fileNameOf, filesNamed, repositoryDirectoryOf } from "./checks-paths.ts";

describe("directoryOf", () => {
  it("gives the folder a file sits in", () => {
    expect(directoryOf({ path: repoPathOf("packages/a/package.json") })).toBe("packages/a");
  });

  it("gives an empty name for a file at the repository root", () => {
    expect(directoryOf({ path: repoPathOf("package.json") })).toBe("");
  });
});

describe("repositoryDirectoryOf", () => {
  it("gives the folder a file sits in as a repository path", () => {
    expect(repositoryDirectoryOf({ path: repoPathOf("packages/a/package.json") })).toBe(
      "packages/a",
    );
  });

  it("names the repository root for a file at the root", () => {
    expect(repositoryDirectoryOf({ path: repoPathOf("package.json") })).toBe("repo-root");
  });
});

describe("fileNameOf", () => {
  it("gives the last segment of a path", () => {
    expect(fileNameOf({ path: repoPathOf("packages/a/package.json") })).toBe("package.json");
  });
});

describe("filesNamed", () => {
  it("gives the tracked paths whose file name is the one asked for, at any depth", () => {
    expect(
      filesNamed({
        trackedPaths: [
          repoPathOf("package.json"),
          repoPathOf("packages/a/package.json"),
          repoPathOf("packages/a/src/a.ts"),
        ],
        name: "package.json",
      }),
    ).toEqual(["package.json", "packages/a/package.json"]);
  });
});

import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { directoryOf, fileNameOf, filesNamed, repositoryDirectoryOf } from "./checks-paths.ts";

describe("directoryOf", () => {
  it("gives the folder a file sits in", () => {
    expect(directoryOf({ path: repoPathSchema.parse("packages/a/package.json") })).toBe("packages/a");
  });

  it("gives an empty name for a file at the repository root", () => {
    expect(directoryOf({ path: repoPathSchema.parse("package.json") })).toBe("");
  });
});

describe("repositoryDirectoryOf", () => {
  it("gives the folder a file sits in as a repository path", () => {
    expect(repositoryDirectoryOf({ path: repoPathSchema.parse("packages/a/package.json") })).toBe("packages/a");
  });

  it("names the repository root for a file at the root", () => {
    expect(repositoryDirectoryOf({ path: repoPathSchema.parse("package.json") })).toBe("repo-root");
  });
});

describe("fileNameOf", () => {
  it("gives the last segment of a path", () => {
    expect(fileNameOf({ path: repoPathSchema.parse("packages/a/package.json") })).toBe("package.json");
  });
});

describe("filesNamed", () => {
  it("gives the tracked paths whose file name is the one asked for, at any depth", () => {
    expect(
      filesNamed({
        trackedPaths: [repoPathSchema.parse("package.json"), repoPathSchema.parse("packages/a/package.json"), repoPathSchema.parse("packages/a/src/a.ts")],
        name: "package.json",
      }),
    ).toEqual(["package.json", "packages/a/package.json"]);
  });
});

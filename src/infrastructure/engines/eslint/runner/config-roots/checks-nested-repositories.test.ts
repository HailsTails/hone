import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { nestedVersionTwoRepositoriesOf } from "./checks-nested-repositories.ts";

const ROOT_SETTINGS = repoPathOf("hone.config.json");

const NESTED_SETTINGS = repoPathOf("vendor/lib/hone.config.json");

const NESTED_SOURCE = repoPathOf("vendor/lib/src/a.ts");

const OWN_SOURCE = repoPathOf("src/a.ts");

const NESTED_VERSION_ONE_SETTINGS = repoPathOf("vendor/lib/disciplines.json");

describe("nestedVersionTwoRepositoriesOf", () => {
  it("names a folder with its own hone.config.json that holds a file to check", () => {
    expect(
      nestedVersionTwoRepositoriesOf({
        trackedPaths: [ROOT_SETTINGS, NESTED_SETTINGS, NESTED_SOURCE],
        files: [NESTED_SOURCE],
      }),
    ).toEqual(["vendor/lib"]);
  });

  it("does not name the repository root's own hone.config.json", () => {
    expect(
      nestedVersionTwoRepositoriesOf({
        trackedPaths: [ROOT_SETTINGS, OWN_SOURCE],
        files: [OWN_SOURCE],
      }),
    ).toEqual([]);
  });

  it("does not name a nested folder holding no file to check", () => {
    expect(
      nestedVersionTwoRepositoriesOf({ trackedPaths: [NESTED_SETTINGS], files: [OWN_SOURCE] }),
    ).toEqual([]);
  });

  it("does not name a folder holding only a version 1 disciplines.json", () => {
    expect(
      nestedVersionTwoRepositoriesOf({
        trackedPaths: [NESTED_VERSION_ONE_SETTINGS, NESTED_SOURCE],
        files: [NESTED_SOURCE],
      }),
    ).toEqual([]);
  });
});

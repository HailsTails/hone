import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { nestedVersionTwoFoldersOf } from "./checks-nested-repositories.ts";

const ROOT_SETTINGS = repoPathOf("hone.config.json");

const NESTED_SETTINGS = repoPathOf("vendor/lib/hone.config.json");

const NESTED_SOURCE = repoPathOf("vendor/lib/src/a.ts");

const OWN_SOURCE = repoPathOf("src/a.ts");

const NESTED_VERSION_ONE_SETTINGS = repoPathOf("vendor/lib/disciplines.json");

describe("nestedVersionTwoFoldersOf", () => {
  it("names a folder with its own hone.config.json", () => {
    expect(
      nestedVersionTwoFoldersOf({
        trackedPaths: [ROOT_SETTINGS, NESTED_SETTINGS, NESTED_SOURCE],
      }),
    ).toEqual(["vendor/lib"]);
  });

  it("does not name the repository root's own hone.config.json", () => {
    expect(
      nestedVersionTwoFoldersOf({
        trackedPaths: [ROOT_SETTINGS, OWN_SOURCE],
      }),
    ).toEqual([]);
  });

  it("does not name a folder holding only a version 1 disciplines.json", () => {
    expect(
      nestedVersionTwoFoldersOf({
        trackedPaths: [NESTED_VERSION_ONE_SETTINGS, NESTED_SOURCE],
      }),
    ).toEqual([]);
  });
});

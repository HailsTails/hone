import { describe, expect, it } from "vitest";

import { COMMANDS, REPO_OPTION, UPGRADE_REPO_OPTION, subcommandOf } from "./command-line.ts";

describe("subcommandOf", () => {
  it.each([
    { given: "check", expected: "check" },
    { given: "project", expected: "project" },
    { given: "lint", expected: undefined },
    { given: undefined, expected: undefined },
  ])("reads $given as $expected", ({ given, expected }) => {
    expect(subcommandOf({ given })).toBe(expected);
  });
});

describe("COMMANDS", () => {
  it("names the value choices of each check option from the values the option accepts", () => {
    expect(COMMANDS.check.options).toMatchObject([
      { name: "--repo", value: "<dir>", need: "required" },
      { name: "--base-revision", value: "<revision>", need: "optional" },
      {
        name: "--report-output",
        value: "<full|failures-only|counts|verdict-only>",
        need: "optional",
      },
      { name: "--forfeiture", value: "<this-run|elsewhere>", need: "optional" },
    ]);
  });

  it("gives project only --repo", () => {
    expect(COMMANDS.project.options).toMatchObject([{ name: "--repo", need: "required" }]);
  });

  it("names hone.config.json for --repo, and disciplines.json only for the upgrade of a version 1 repository", () => {
    expect(REPO_OPTION.summary).toBe(
      "the folder that holds hone.config.json, usually the repository root",
    );
    expect(COMMANDS.upgrade.options).toEqual([UPGRADE_REPO_OPTION]);
    expect(UPGRADE_REPO_OPTION.summary).toBe(
      "the folder that holds disciplines.json, usually the repository root",
    );
  });
});

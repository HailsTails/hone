import { describe, expect, it } from "vitest";

import {
  AUTHORISE_COMMAND_OPTIONS,
  COMMANDS,
  REPO_OPTION,
  VERSION_ONE_REPO_OPTION,
  subcommandOf,
} from "./command-line.ts";

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
      { name: "--forfeiture", value: "<this-run|elsewhere|no-new-findings>", need: "optional" },
    ]);
  });

  it("gives authorise --answers once and always, and --outside-party once when given", () => {
    expect(AUTHORISE_COMMAND_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "--answers", need: "required", occurrence: "once" }),
        expect.objectContaining({
          name: "--outside-party",
          value: "<party>",
          need: "optional",
          occurrence: "once",
        }),
      ]),
    );
  });

  it("gives project only --repo", () => {
    expect(COMMANDS.project.options).toMatchObject([{ name: "--repo", need: "required" }]);
  });

  it("names hone.config.json for --repo, and disciplines.json only for the commands that take a version 1 repository", () => {
    expect(REPO_OPTION.summary).toBe(
      "the folder that holds hone.config.json, usually the repository root",
    );
    expect(COMMANDS.upgrade.options).toEqual([VERSION_ONE_REPO_OPTION]);
    expect(COMMANDS["split-records"].options).toEqual([VERSION_ONE_REPO_OPTION]);
    expect(VERSION_ONE_REPO_OPTION.summary).toBe(
      "the folder that holds disciplines.json, usually the repository root",
    );
  });
});

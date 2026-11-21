import { describe, expect, it } from "vitest";
import { COMMANDS, subcommandOf } from "./command-line.ts";

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
      { name: "--report-output", value: "<full|failures-only|counts|verdict-only>", need: "optional" },
      { name: "--forfeiture", value: "<this-run|elsewhere>", need: "optional" },
    ]);
  });

  it("gives project only --repo", () => {
    expect(COMMANDS.project.options).toMatchObject([{ name: "--repo", need: "required" }]);
  });
});

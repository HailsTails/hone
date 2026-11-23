import { describe, expect, it } from "vitest";

import { argumentProblemText, argumentsInvalid } from "./argument-problem.ts";
import {
  FORFEITURE_OPTION,
  LEAVE_OPTION,
  REPO_OPTION,
  REPORT_OUTPUT_OPTION,
} from "./command-line.ts";

describe("argumentProblemText", () => {
  it.each([
    {
      problem: { kind: "command-missing" },
      text: "hone needs a command, check, project, record-debt, prune-debt, authorise, split-records or upgrade; run hone --help for usage",
    },
    {
      problem: { kind: "command-unknown", given: "lint" },
      text: 'hone has no command "lint"; its commands are check, project, record-debt, prune-debt, authorise, split-records and upgrade; run hone --help for usage',
    },
    {
      problem: { kind: "argument-unexpected", subcommand: "check", given: "src" },
      text: 'hone check takes options, not "src" on its own; give each option and its value as two arguments, as in --repo <dir>; run hone check --help for its options',
    },
    {
      problem: { kind: "flag-extra", flag: "--version", given: "extra" },
      text: 'hone --version takes nothing after it, not "extra"; run hone --help for usage',
    },
    {
      problem: { kind: "argument-unexpected", subcommand: "project", given: "src" },
      text: 'hone project takes options, not "src" on its own; give each option and its value as two arguments, as in --repo <dir>; run hone project --help for its options',
    },
    {
      problem: { kind: "option-unknown", subcommand: "project", given: "--base-revision" },
      text: 'hone project has no option "--base-revision"; run hone project --help for its options',
    },
    {
      problem: { kind: "option-joined", option: REPO_OPTION, given: "--repo=src" },
      text: 'give --repo and its value as two arguments, as in --repo <dir>, not "--repo=src"',
    },
    {
      problem: { kind: "value-missing", option: REPO_OPTION },
      text: "--repo needs a value, as in --repo <dir>",
    },
    {
      problem: { kind: "option-repeated", option: FORFEITURE_OPTION },
      text: "--forfeiture is given more than once; give it once",
    },
    {
      problem: { kind: "option-required", subcommand: "check", option: REPO_OPTION },
      text: "hone check needs --repo <dir>: the folder that holds hone.config.json, usually the repository root",
    },
  ] as const)("words $problem.kind for the person who typed the command", ({ problem, text }) => {
    expect(argumentProblemText({ problem })).toBe(text);
  });
});

describe("argumentProblemText for values and the repository folder", () => {
  it.each([
    {
      problem: {
        kind: "choice-invalid",
        option: REPORT_OUTPUT_OPTION,
        choices: ["full", "failures-only", "counts", "verdict-only"],
        given: "summary",
      },
      text: '--report-output takes full, failures-only, counts or verdict-only, not "summary"',
    },
    {
      problem: {
        kind: "option-removed",
        given: "--waived-clauses",
        instead: "mark the clause not-run",
      },
      text: 'removed: "--waived-clauses"; mark the clause not-run',
    },
    {
      problem: { kind: "repo-unresolvable", given: "src" },
      text: "--repo src resolves to no absolute path",
    },
    {
      problem: { kind: "path-invalid", option: LEAVE_OPTION, given: "src/*.ts" },
      text: '--leave takes one exact file or folder inside --repo, relative to it, with forward slashes and no *, not "src/*.ts"',
    },
  ] as const)("words $problem.kind for the person who typed the command", ({ problem, text }) => {
    expect(argumentProblemText({ problem })).toBe(text);
  });
});

describe("argumentsInvalid", () => {
  it("carries the worded problem as the detail of an arguments-invalid load failure", () => {
    expect(argumentsInvalid({ problem: { kind: "command-missing" } })).toEqual({
      outcome: "failed",
      error: {
        kind: "arguments-invalid",
        detail:
          "hone needs a command, check, project, record-debt, prune-debt, authorise, split-records or upgrade; run hone --help for usage",
      },
    });
  });
});

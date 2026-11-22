import { describe, expect, it } from "vitest";

import {
  REPORT_OUTPUTS,
  VERSION_TWO_REPORT_OUTPUTS,
} from "../../../domain/settings/report-output.ts";
import { argumentProblemText } from "./argument-problem.ts";
import {
  parseAuthoriseArguments,
  parseCheckArguments,
  parseInvocation,
  parseProjectArguments,
  parsePruneDebtArguments,
  parseRecordDebtArguments,
  parseSplitRecordsArguments,
} from "./command-arguments.ts";
import {
  ADOPTION_BASE_REVISION_OPTION,
  FORFEITURE_OPTION,
  LEAVE_OPTION,
  REPO_OPTION,
  REPORT_OUTPUT_OPTION,
} from "./command-line.ts";

const invalid = (request: { readonly detail: string }) => ({
  outcome: "failed",
  error: { kind: "arguments-invalid", detail: request.detail },
});

describe("parseInvocation", () => {
  it.each([
    {
      given: ["check", "--repo", "/work/repo"],
      expected: { kind: "run", subcommand: "check", arguments: ["--repo", "/work/repo"] },
    },
    {
      given: ["project", "--repo", "/work/repo"],
      expected: { kind: "run", subcommand: "project", arguments: ["--repo", "/work/repo"] },
    },
    {
      given: ["record-debt", "--repo", "."],
      expected: { kind: "run", subcommand: "record-debt", arguments: ["--repo", "."] },
    },
    {
      given: ["split-records", "--repo", "."],
      expected: { kind: "run", subcommand: "split-records", arguments: ["--repo", "."] },
    },
    {
      given: ["record-debt", "--leave", "src/a.ts", "-h"],
      expected: { kind: "help", topic: "record-debt" },
    },
    { given: ["--help"], expected: { kind: "help", topic: "tool" } },
    { given: ["-h"], expected: { kind: "help", topic: "tool" } },
    { given: ["--version"], expected: { kind: "version" } },
    { given: ["check", "--help"], expected: { kind: "help", topic: "check" } },
    {
      given: ["project", "--repo", "/work/repo", "-h"],
      expected: { kind: "help", topic: "project" },
    },
    { given: ["--help", "check"], expected: { kind: "help", topic: "check" } },
    { given: ["check", "--", "--help"], expected: { kind: "help", topic: "check" } },
    {
      given: ["check", "--repo", "/work/repo", "--", "-h"],
      expected: { kind: "help", topic: "check" },
    },
  ])("reads $given", ({ given, expected }) => {
    expect(parseInvocation({ arguments: given })).toEqual({ outcome: "ok", value: expected });
  });

  it.each([
    { given: [], problem: { kind: "command-missing" } },
    {
      given: ["lint", "--repo", "/work/repo"],
      problem: { kind: "command-unknown", given: "lint" },
    },
    {
      given: ["--repo", "/work/repo", "check"],
      problem: { kind: "command-unknown", given: "--repo" },
    },
    {
      given: ["--version", "extra"],
      problem: { kind: "flag-extra", flag: "--version", given: "extra" },
    },
    { given: ["--help", "lint"], problem: { kind: "flag-extra", flag: "--help", given: "lint" } },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parseInvocation({ arguments: given })).toEqual(
      invalid({ detail: argumentProblemText({ problem }) }),
    );
  });
});

describe("parseCheckArguments", () => {
  it.each([
    { given: ["--repo", "/work/repo"], expected: { repo: "/work/repo" } },
    {
      given: ["--base-revision", "origin/main", "--repo", "/work/repo"],
      expected: { repo: "/work/repo", baseRevision: "origin/main" },
    },
    {
      given: ["--repo", "/work/repo", "--report-output", "counts"],
      expected: { repo: "/work/repo", reportOutput: "counts" },
    },
    {
      given: ["--repo", "/work/repo", "--forfeiture", "elsewhere"],
      expected: { repo: "/work/repo", forfeiture: "elsewhere" },
    },
    {
      given: ["--repo", "/work/repo", "--", "--base-revision", "origin/main"],
      expected: { repo: "/work/repo", baseRevision: "origin/main" },
    },
    { given: ["--", "--repo", "/work/repo"], expected: { repo: "/work/repo" } },
    { given: ["--repo", "/work/repo", "--"], expected: { repo: "/work/repo" } },
  ])("reads $given", ({ given, expected }) => {
    expect(parseCheckArguments({ arguments: given, reportOutputs: REPORT_OUTPUTS })).toEqual({
      outcome: "ok",
      value: {
        baseRevision: undefined,
        reportOutput: undefined,
        forfeiture: undefined,
        ...expected,
      },
    });
  });
});

describe("parseCheckArguments over the version 2 report outputs", () => {
  it("reads actionable as the output to print", () => {
    expect(
      parseCheckArguments({
        arguments: ["--repo", "/work/repo", "--report-output", "actionable"],
        reportOutputs: VERSION_TWO_REPORT_OUTPUTS,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        repo: "/work/repo",
        baseRevision: undefined,
        reportOutput: "actionable",
        forfeiture: undefined,
      },
    });
  });

  it("refuses failures-only, which version 2 does not know", () => {
    expect(
      parseCheckArguments({
        arguments: ["--repo", "/work/repo", "--report-output", "failures-only"],
        reportOutputs: VERSION_TWO_REPORT_OUTPUTS,
      }),
    ).toEqual(
      invalid({
        detail:
          '--report-output takes full, actionable, counts or verdict-only, not "failures-only"',
      }),
    );
  });
});

describe("parseCheckArguments refusing what it cannot read", () => {
  it.each([
    { given: [], problem: { kind: "option-required", subcommand: "check", option: REPO_OPTION } },
    { given: ["--repo"], problem: { kind: "value-missing", option: REPO_OPTION } },
    {
      given: ["--repo", "--report-output", "full"],
      problem: { kind: "value-missing", option: REPO_OPTION },
    },
    {
      given: ["--repo", "/work/repo", "--fix"],
      problem: { kind: "option-unknown", subcommand: "check", given: "--fix" },
    },
    {
      given: ["--repo", "/work/repo", "-x"],
      problem: { kind: "option-unknown", subcommand: "check", given: "-x" },
    },
    { given: ["--repo", "-h"], problem: { kind: "value-missing", option: REPO_OPTION } },
    {
      given: ["--repo", "/work/repo", "src"],
      problem: { kind: "argument-unexpected", subcommand: "check", given: "src" },
    },
    {
      given: ["--repo", "/work/repo", "--", "src"],
      problem: { kind: "argument-unexpected", subcommand: "check", given: "src" },
    },
    { given: ["--repo", "--"], problem: { kind: "value-missing", option: REPO_OPTION } },
    {
      given: ["--repo", "--", "/work/repo"],
      problem: { kind: "value-missing", option: REPO_OPTION },
    },
    {
      given: ["--repo=/work/repo"],
      problem: { kind: "option-joined", option: REPO_OPTION, given: "--repo=/work/repo" },
    },
    {
      given: ["--repo", "/a", "--repo", "/b"],
      problem: { kind: "option-repeated", option: REPO_OPTION },
    },
    {
      given: ["--repo", "/work/repo", "--report-output", "summary"],
      problem: {
        kind: "choice-invalid",
        option: REPORT_OUTPUT_OPTION,
        choices: ["full", "failures-only", "counts", "verdict-only"],
        given: "summary",
      },
    },
    {
      given: ["--repo", "/work/repo", "--forfeiture", "reported"],
      problem: {
        kind: "choice-invalid",
        option: FORFEITURE_OPTION,
        choices: ["this-run", "elsewhere"],
        given: "reported",
      },
    },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parseCheckArguments({ arguments: given, reportOutputs: REPORT_OUTPUTS })).toEqual(
      invalid({ detail: argumentProblemText({ problem }) }),
    );
  });

  it.each([
    { given: ["--repo", "/work/repo", "--waived-clauses", "not-run"] },
    { given: ["--waived-clauses", "run", "--repo", "/work/repo"] },
  ])("names the removed --waived-clauses and what replaces it, given $given", ({ given }) => {
    expect(parseCheckArguments({ arguments: given, reportOutputs: REPORT_OUTPUTS })).toEqual(
      invalid({
        detail:
          'removed: "--waived-clauses"; in clauses, mark a clause "not-run" when its mechanism does not run, or "not-adopted" when its rule does not apply; see MIGRATING.md section 12',
      }),
    );
  });
});

describe("parseProjectArguments", () => {
  it.each([{ given: ["--repo", "/work/repo"] }, { given: ["--", "--repo", "/work/repo"] }])(
    "reads --repo from $given",
    ({ given }) => {
      expect(parseProjectArguments({ arguments: given })).toEqual({
        outcome: "ok",
        value: { repo: "/work/repo" },
      });
    },
  );

  it.each([
    { given: [], problem: { kind: "option-required", subcommand: "project", option: REPO_OPTION } },
    {
      given: ["--repo", "/work/repo", "--base-revision", "main"],
      problem: { kind: "option-unknown", subcommand: "project", given: "--base-revision" },
    },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parseProjectArguments({ arguments: given })).toEqual(
      invalid({ detail: argumentProblemText({ problem }) }),
    );
  });
});

describe("parseSplitRecordsArguments", () => {
  it("reads --repo", () => {
    expect(parseSplitRecordsArguments({ arguments: ["--repo", "/work/repo"] })).toEqual({
      outcome: "ok",
      value: { repo: "/work/repo" },
    });
  });

  it.each([
    {
      given: [],
      problem: { kind: "option-required", subcommand: "split-records", option: REPO_OPTION },
    },
    {
      given: ["--repo", "/work/repo", "--base-revision", "main"],
      problem: { kind: "option-unknown", subcommand: "split-records", given: "--base-revision" },
    },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parseSplitRecordsArguments({ arguments: given })).toEqual(
      invalid({ detail: argumentProblemText({ problem }) }),
    );
  });
});

describe("parseRecordDebtArguments", () => {
  it.each([
    { given: ["--repo", "/work/repo", "--base-revision", "HEAD"], leave: [] },
    {
      given: [
        "--base-revision",
        "HEAD",
        "--leave",
        "src/clock.ts",
        "--repo",
        "/work/repo",
        "--leave",
        "src/adapters",
      ],
      leave: ["src/clock.ts", "src/adapters"],
    },
    {
      given: ["--repo", "/work/repo", "--", "--base-revision", "HEAD", "--leave", "src/clock.ts"],
      leave: ["src/clock.ts"],
    },
  ])("reads $given, keeping each --leave path in the order given", ({ given, leave }) => {
    expect(parseRecordDebtArguments({ arguments: given })).toEqual({
      outcome: "ok",
      value: { repo: "/work/repo", baseRevision: "HEAD", leave },
    });
  });

  it.each([
    {
      given: ["--repo", "/work/repo"],
      problem: {
        kind: "option-required",
        subcommand: "record-debt",
        option: ADOPTION_BASE_REVISION_OPTION,
      },
    },
    {
      given: ["--base-revision", "HEAD"],
      problem: { kind: "option-required", subcommand: "record-debt", option: REPO_OPTION },
    },
    {
      given: ["--repo", "/a", "--base-revision", "HEAD", "--base-revision", "main"],
      problem: { kind: "option-repeated", option: ADOPTION_BASE_REVISION_OPTION },
    },
    {
      given: ["--repo", "/a", "--base-revision", "HEAD", "--leave"],
      problem: { kind: "value-missing", option: LEAVE_OPTION },
    },
    {
      given: ["--repo", "/a", "--base-revision", "HEAD", "--forfeiture", "elsewhere"],
      problem: { kind: "option-unknown", subcommand: "record-debt", given: "--forfeiture" },
    },
    {
      given: ["--repo", "/a", "--base-revision", "HEAD", "--leave", "src/*.ts"],
      problem: { kind: "path-invalid", option: LEAVE_OPTION, given: "src/*.ts" },
    },
    {
      given: ["--repo", "/a", "--base-revision", "HEAD", "--leave", "../shared"],
      problem: { kind: "path-invalid", option: LEAVE_OPTION, given: "../shared" },
    },
    {
      given: ["--repo", "/a", "--base-revision", "HEAD", "--leave", "src\\clock.ts"],
      problem: { kind: "path-invalid", option: LEAVE_OPTION, given: "src\\clock.ts" },
    },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parseRecordDebtArguments({ arguments: given })).toEqual(
      invalid({ detail: argumentProblemText({ problem }) }),
    );
  });
});

describe("parsePruneDebtArguments", () => {
  it.each([
    {
      given: ["--repo", "/work/repo"],
      expected: { repo: "/work/repo", baseRevision: undefined, forfeiture: undefined },
    },
    {
      given: [
        "--forfeiture",
        "elsewhere",
        "--repo",
        "/work/repo",
        "--base-revision",
        "origin/main",
      ],
      expected: { repo: "/work/repo", baseRevision: "origin/main", forfeiture: "elsewhere" },
    },
  ] as const)("reads $given", ({ given, expected }) => {
    expect(parsePruneDebtArguments({ arguments: given })).toEqual({
      outcome: "ok",
      value: expected,
    });
  });

  it.each([
    {
      given: ["--base-revision", "origin/main"],
      problem: { kind: "option-required", subcommand: "prune-debt", option: REPO_OPTION },
    },
    {
      given: ["--repo", "/work/repo", "--forfeiture", "reported"],
      problem: {
        kind: "choice-invalid",
        option: FORFEITURE_OPTION,
        choices: ["this-run", "elsewhere"],
        given: "reported",
      },
    },
    {
      given: ["--repo", "/work/repo", "--leave", "src/clock.ts"],
      problem: { kind: "option-unknown", subcommand: "prune-debt", given: "--leave" },
    },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parsePruneDebtArguments({ arguments: given })).toEqual(
      invalid({ detail: argumentProblemText({ problem }) }),
    );
  });
});

describe("parseAuthoriseArguments", () => {
  it("reads --root-evidence beside --repo", () => {
    expect(
      parseAuthoriseArguments({
        arguments: ["--repo", "/work/repo", "--root-evidence", "src/a.ts:1 still holds today"],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        repo: "/work/repo",
        values: new Map([
          ["--repo", ["/work/repo"]],
          ["--root-evidence", ["src/a.ts:1 still holds today"]],
        ]),
      },
    });
  });

  it("refuses --root-check, the version 1 name, as an unknown option", () => {
    expect(
      parseAuthoriseArguments({
        arguments: ["--repo", "/work/repo", "--root-check", "src/a.ts:1 still holds today"],
      }),
    ).toEqual(
      invalid({
        detail: argumentProblemText({
          problem: { kind: "option-unknown", subcommand: "authorise", given: "--root-check" },
        }),
      }),
    );
  });

  it("refuses --symptom, the version 1 name, as an unknown option", () => {
    expect(
      parseAuthoriseArguments({ arguments: ["--repo", "/work/repo", "--symptom", "claimed-type"] }),
    ).toEqual(
      invalid({
        detail: argumentProblemText({
          problem: { kind: "option-unknown", subcommand: "authorise", given: "--symptom" },
        }),
      }),
    );
  });
});

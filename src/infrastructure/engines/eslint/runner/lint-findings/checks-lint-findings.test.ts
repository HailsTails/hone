import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { MisnamedRuleId, SelectedCheck } from "../checks-runner/checks-run-types.ts";
import type { LintedFile } from "../toolchain/eslint-instance.ts";
import { lintedFindingsOf, measuredOn, parseableFile } from "./checks-lint-findings.ts";
import type { LinesReader } from "./source-lines.ts";

const CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-1"),
  clause: clauseIdOf("explicit-any"),
};

const EXPLICIT_ANY: SelectedCheck = {
  address: "untyped-value#explicit-any",
  symptom: "untyped-value",
  ruleId: "hone/untyped-value#explicit-any",
  clause: CLAUSE,
  options: [],
};

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const findingsOf = (request: { readonly linted: LintedFile }) =>
  lintedFindingsOf({
    linted: request.linted,
    path: POSIX,
    repoRoot: absoluteRootOf("/repo"),
    sourceLines: vi
      .fn<LinesReader>()
      .mockReturnValue({ outcome: "ok", value: ["", "", "  const a: any = 1;"] }),
    selected: [EXPLICIT_ANY],
    checkRuleIds: [EXPLICIT_ANY.ruleId],
    versionOneRuleIds: [],
  });

const NO_MISNAMED: readonly MisnamedRuleId[] = [];

describe("lintedFindingsOf", () => {
  it("gives a rule's message as a hit at its line and column, its snippet cut from the source line, naming the check, and measures the clause on the file", () => {
    expect(
      findingsOf({
        linted: {
          filePath: "/repo/src/a.ts",
          messages: [{ ruleId: EXPLICIT_ANY.ruleId, line: 3, column: 10, message: "any" }],
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [
          {
            clause: CLAUSE,
            file: "src/a.ts",
            anchor: { line: 3, column: 9 },
            snippet: "const a: any = 1;",
            check: "untyped-value#explicit-any",
          },
        ],
        nativeExceptions: [],
        measured: [{ clause: CLAUSE, file: "src/a.ts" }],
        misnamedRuleIds: NO_MISNAMED,
      },
    });
  });

  it("measures nothing on a file with a message that names no rule", () => {
    expect(
      findingsOf({
        linted: {
          filePath: "/repo/src/a.ts",
          messages: [{ ruleId: null, line: 1, column: 1, message: "odd" }],
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: NO_MISNAMED },
    });
  });

  it("fails as an unparseable file when a message is fatal", () => {
    expect(
      findingsOf({
        linted: {
          filePath: "/repo/src/a.ts",
          messages: [{ ruleId: null, line: 1, column: 1, message: "Parsing error", fatal: true }],
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unparseable", file: "src/a.ts", detail: "Parsing error" },
    });
  });

  it("fails when ESLint linted a file outside the repository", () => {
    expect(findingsOf({ linted: { filePath: "/elsewhere/a.ts", messages: [] } })).toEqual({
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: "ESLint linted /elsewhere/a.ts, which is outside the repository",
      },
    });
  });
});

describe("parseableFile", () => {
  it("gives the repository path of a linted file with no fatal message", () => {
    expect(
      parseableFile({
        linted: { filePath: "/repo/src/a.ts", messages: [] },
        path: POSIX,
        repoRoot: absoluteRootOf("/repo"),
      }),
    ).toEqual({
      outcome: "ok",
      value: "src/a.ts",
    });
  });

  it("fails as unparseable, naming the file, on a fatal message", () => {
    expect(
      parseableFile({
        linted: {
          filePath: "/repo/src/a.ts",
          messages: [{ ruleId: null, line: 1, column: 1, message: "Parsing error", fatal: true }],
        },
        path: POSIX,
        repoRoot: absoluteRootOf("/repo"),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unparseable", file: "src/a.ts", detail: "Parsing error" },
    });
  });
});

describe("measuredOn", () => {
  it("measures each distinct clause once on the file", () => {
    expect(
      measuredOn({
        file: repoPathOf("src/a.ts"),
        linted: { filePath: "/repo/src/a.ts", messages: [] },
        clauses: [CLAUSE, CLAUSE],
      }),
    ).toEqual([{ clause: CLAUSE, file: "src/a.ts" }]);
  });

  it("measures nothing when a message names no rule", () => {
    expect(
      measuredOn({
        file: repoPathOf("src/a.ts"),
        linted: {
          filePath: "/repo/src/a.ts",
          messages: [{ ruleId: null, line: 1, column: 1, message: "odd" }],
        },
        clauses: [CLAUSE],
      }),
    ).toEqual([]);
  });
});

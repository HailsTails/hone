import { describe, expect, it } from "vitest";

import type { CheckAddressText } from "../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { versionOneAnsweredFilesOf, versionOneObservationsOf } from "./version-one-observations.ts";

const PATH = repoPathOf("src/sample.test.ts");
const CLAUSE: ClauseAddress = {
  ruleSet: "hone",
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};
const CHECK: CheckAddressText = "rebinding#test-body";
const WALKER: EngineId = "walker";
const NAMES = new Map([[WALKER, new Map([[CHECK, CLAUSE]])]]);

describe("versionOneObservationsOf", () => {
  it("restores a clause finding and the version one reach of an inline exception", () => {
    expect(
      versionOneObservationsOf({
        names: NAMES,
        runs: [
          {
            mechanism: "walker",
            hits: [
              {
                check: CHECK,
                file: PATH,
                anchor: { line: 2, column: 0 },
                snippet: "let sample = 1",
              },
            ],
            nativeExceptions: [
              {
                kind: "inline-disable",
                check: CHECK,
                file: PATH,
                line: 1,
                text: "// @ts-ignore",
                reach: "one-check",
              },
            ],
            coverableKinds: [],
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        findings: [
          {
            clause: CLAUSE,
            mechanism: "walker",
            file: PATH,
            anchor: { line: 2, column: 0 },
            snippet: "let sample = 1",
          },
        ],
        runs: [
          {
            mechanism: "walker",
            nativeExceptions: [
              {
                kind: "inline-disable",
                clause: CLAUSE,
                file: PATH,
                line: 1,
                text: "// @ts-ignore",
                reach: "one-clause",
              },
            ],
            coverableKinds: [],
          },
        ],
      },
    });
  });

  it("refuses an observation whose check has no selected clause on the reporting engine", () => {
    expect(
      versionOneObservationsOf({
        names: NAMES,
        runs: [
          {
            mechanism: "eslint",
            hits: [
              {
                check: CHECK,
                file: PATH,
                anchor: { line: 2, column: 0 },
                snippet: "let sample = 1",
              },
            ],
            nativeExceptions: [],
            coverableKinds: [],
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "version-one-run-failed",
        detail: "eslint reported rebinding#test-body without a selected version one clause",
      },
    });
  });
});

describe("versionOneAnsweredFilesOf", () => {
  it("answers a carve-out's file with each check of its clause, owned by the clause's rule set", () => {
    const teamClause: ClauseAddress = { ...CLAUSE, ruleSet: { name: ruleSetNameOf("acme") } };
    expect(
      versionOneAnsweredFilesOf({
        names: new Map([[WALKER, new Map([[CHECK, teamClause]])]]),
        records: [{ kind: "file-carve-out", clause: teamClause, mechanism: WALKER, file: PATH }],
      }),
    ).toEqual([
      { ruleSet: { name: "acme" }, symptom: "rebinding", check: "test-body", file: PATH },
    ]);
  });
});

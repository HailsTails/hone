import { describe, expect, it } from "vitest";
import type { RuledCheck } from "../hone-plugin/check-rule-id.ts";
import { selectedChecksOf } from "./checks-selection.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";

const CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-1"), clause: clauseIdOf("explicit-any") };

const EXPLICIT_ANY: RuledCheck = {
  name: "explicit-any",
  symptom: { name: "untyped-value", title: "Untyped value" },
  clause: CLAUSE,
  engines: [{ name: "eslint" }],
};

describe("selectedChecksOf", () => {
  it("gives each projected check its address, rule id, clause and options", () => {
    expect(
      selectedChecksOf({ checks: [EXPLICIT_ANY], projected: [{ symptom: "untyped-value", check: "explicit-any", ruleId: "hone/untyped-value#explicit-any", options: [{ ignoreRestArgs: true }] }] }),
    ).toEqual({
      outcome: "ok",
      value: [{ address: "untyped-value#explicit-any", symptom: "untyped-value", ruleId: "hone/untyped-value#explicit-any", clause: CLAUSE, options: [{ ignoreRestArgs: true }] }],
    });
  });

  it("fails for a projected rule id that names no check of the catalogue that runs on ESLint", () => {
    expect(selectedChecksOf({ checks: [EXPLICIT_ANY], projected: [{ symptom: "untyped-value", check: "gone", ruleId: "hone/untyped-value#gone", options: [] }] })).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "the rule hone/untyped-value#gone names no check of the catalogue that runs on ESLint" },
    });
  });
});

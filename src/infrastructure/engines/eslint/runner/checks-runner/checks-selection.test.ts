import { describe, expect, it } from "vitest";

import type { PluginCheck } from "../hone-plugin/check-rule-id.ts";
import { selectedNamedChecksOf } from "./checks-selection.ts";

const EXPLICIT_ANY: PluginCheck = {
  name: "explicit-any",
  symptom: { name: "untyped-value", title: "Untyped value" },
  engines: [{ name: "eslint" }],
};

describe("selectedNamedChecksOf", () => {
  it("gives each projected check its address, rule id and options", () => {
    expect(
      selectedNamedChecksOf({
        checks: [EXPLICIT_ANY],
        projected: [
          {
            symptom: "untyped-value",
            check: "explicit-any",
            ruleId: "hone/untyped-value#explicit-any",
            options: [{ ignoreRestArgs: true }],
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          address: "untyped-value#explicit-any",
          symptom: "untyped-value",
          ruleId: "hone/untyped-value#explicit-any",
          options: [{ ignoreRestArgs: true }],
        },
      ],
    });
  });

  it("fails for a projected rule id that names no check of the catalogue that runs on ESLint", () => {
    expect(
      selectedNamedChecksOf({
        checks: [EXPLICIT_ANY],
        projected: [
          {
            symptom: "untyped-value",
            check: "gone",
            ruleId: "hone/untyped-value#gone",
            options: [],
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail:
          "the rule hone/untyped-value#gone names no check of the catalogue that runs on ESLint",
      },
    });
  });

  it("retains the team's projected rule id and resolves it to the named check", () => {
    expect(
      selectedNamedChecksOf({
        checks: [EXPLICIT_ANY],
        projected: [
          {
            symptom: "untyped-value",
            check: "explicit-any",
            ruleId: "team/no-any",
            options: [],
            plugin: { namespace: "team", module: "plugin.ts", pieceRoot: "/repo/tools/team" },
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          address: "untyped-value#explicit-any",
          symptom: "untyped-value",
          ruleId: "team/no-any",
          options: [],
        },
      ],
    });
  });
});

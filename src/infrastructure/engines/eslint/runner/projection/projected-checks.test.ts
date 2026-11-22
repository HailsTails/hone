import { describe, expect, it } from "vitest";
import type { ClauseBinding } from "../../../../../domain/settings/selection/selection.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { Check, Engine, Symptom } from "../../../../../domain/language-layer/symptom-catalogue.ts";
import { checksPluginImportOf, projectedChecksOf } from "./projected-checks.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { ruleSetNameOf } from "../../../../../domain/rule-set/rule-set-name-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";

const WALKER_ENGINE: Engine = { name: "walker", mechanism: "audit" };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: "eslint" };

const TEST_SWITCHED_OFF: Symptom = {
  name: "test-switched-off",
  title: "Test switched off",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const POSITIONAL_PARAMETERS: Symptom = {
  name: "positional-parameters",
  title: "Positional parameters",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  name: "rebinding",
  title: "Rebinding",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const SKIPPED_TESTS_CHECK: Check = {
  name: "skipped-tests",
  symptom: TEST_SWITCHED_OFF,
  clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("skipped-tests") },
  engines: [ESLINT_ENGINE],
  forms: [],
};

const NON_NULL_ASSERTIONS_CHECK: Check = {
  name: "non-null-assertions",
  symptom: CLAIMED_TYPE,
  clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("non-null-assertions") },
  engines: [ESLINT_ENGINE],
  forms: [],
};

const PARAMETER_COUNT_CHECK: Check = {
  name: "parameter-count",
  symptom: POSITIONAL_PARAMETERS,
  clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-40"), clause: clauseIdOf("parameter-count") },
  engines: [ESLINT_ENGINE],
  forms: [],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") },
  engines: [WALKER_ENGINE],
  forms: ["a-let"],
};

const PLUGIN_CHECKS: readonly Check[] = [SKIPPED_TESTS_CHECK, NON_NULL_ASSERTIONS_CHECK, PARAMETER_COUNT_CHECK, REBINDING_TEST_BODY];

const ESLINT = "eslint" as const;

const AUDIT = "audit" as const;

const PARAMETER_COUNT_BINDING: ClauseBinding = {
  mechanism: ESLINT,
  clause: {
    address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-40"), clause: clauseIdOf("parameter-count") },
    anchor: { kind: "file" },
    pieceRoot: "/install/mechanisms/eslint/CD-40",
    settings: { pluginNamespace: "hone-cd40", pluginModule: "cd40/cd40.eslint-plugin.ts", rule: "max-params", options: [{ max: 2, countVoidThis: true }] },
    clauseSettings: {},
    edition: editionOf("1"),
  },
};

const SKIPPED_TESTS_BINDING: ClauseBinding = {
  mechanism: ESLINT,
  clause: {
    address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("skipped-tests") },
    anchor: { kind: "file" },
    pieceRoot: "/install/mechanisms/eslint/CD-27",
    settings: { pluginNamespace: "hone-cd27", pluginModule: "cd27/cd27.eslint-plugin.ts", rule: "skipped-tests" },
    clauseSettings: {},
    edition: editionOf("1"),
  },
};

const WALKER_BINDING: ClauseBinding = {
  mechanism: AUDIT,
  clause: {
    address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") },
    anchor: { kind: "file" },
    pieceRoot: "/install/mechanisms/audit/CD-27",
    settings: { module: "test-body-logic.ts" },
    clauseSettings: {},
    edition: editionOf("1"),
  },
};

const OTHER_RULE_SET_CHECK: Check = { ...SKIPPED_TESTS_CHECK, clause: { ruleSet: { name: ruleSetNameOf("acme") }, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("skipped-tests") } };

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("projectedChecksOf", () => {
  it("projects each ESLint binding's check under its rule id, with the piece's options, and no binding of another engine", () => {
    expect(
      projectedChecksOf({ checks: PLUGIN_CHECKS, bindings: [SKIPPED_TESTS_BINDING, WALKER_BINDING, PARAMETER_COUNT_BINDING] }),
    ).toEqual({
      outcome: "ok",
      value: [
        { symptom: "test-switched-off", check: "skipped-tests", ruleId: "hone/test-switched-off#skipped-tests", options: [] },
        { symptom: "positional-parameters", check: "parameter-count", ruleId: "hone/positional-parameters#parameter-count", options: [{ max: 2, countVoidThis: true }] },
      ],
    });
  });

  it("refuses an ESLint binding whose settings are not an ESLint piece's, naming its piece", () => {
    expect(
      projectedChecksOf({
        checks: PLUGIN_CHECKS,
        bindings: [{ mechanism: ESLINT, clause: { ...SKIPPED_TESTS_BINDING.clause, settings: { module: "skipped-tests.ts" } } }],
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "piece-invalid", pieceRoot: "/install/mechanisms/eslint/CD-27" } });
  });

  it("refuses an ESLint binding whose clause no check runs on ESLint, naming its clause", () => {
    expect(
      projectedChecksOf({
        checks: PLUGIN_CHECKS,
        bindings: [{ mechanism: ESLINT, clause: { ...SKIPPED_TESTS_BINDING.clause, address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("focused-tests") } } }],
      }),
    ).toEqual({ outcome: "failed", error: { kind: "check-unknown", address: "CD-27#focused-tests" } });
  });

  it("refuses an ESLint binding whose check is another rule set's, which the plugin holds no rule for, naming its clause", () => {
    expect(
      projectedChecksOf({
        checks: [OTHER_RULE_SET_CHECK],
        bindings: [{ mechanism: ESLINT, clause: { ...SKIPPED_TESTS_BINDING.clause, address: { ruleSet: { name: ruleSetNameOf("acme") }, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("skipped-tests") } } }],
      }),
    ).toEqual({ outcome: "failed", error: { kind: "check-outside-rule-set", address: "acme/CD-27#skipped-tests" } });
  });
});

describe("checksPluginImportOf", () => {
  it("imports the package's plugin export by name from a package install", () => {
    expect(
      checksPluginImportOf({
        path: PATH,
        importingDirectory: absoluteRootOf("/repo"),
        installRoot: absoluteRootOf("/repo/node_modules/@hailstails/hone"),
        install: { form: "package", root: "/repo/node_modules/@hailstails/hone", name: "@hailstails/hone" },
      }),
    ).toEqual({ placement: "importable", specifier: "@hailstails/hone/eslint-plugin" });
  });

  it("imports the plugin's source by a relative path from a source install", () => {
    expect(
      checksPluginImportOf({
        path: PATH,
        importingDirectory: absoluteRootOf("/repo/packages/web"),
        installRoot: absoluteRootOf("/repo"),
        install: { form: "source" },
      }),
    ).toEqual({ placement: "importable", specifier: "../../src/eslint-plugin.ts" });
  });
});

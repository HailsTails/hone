import { describe, expect, it } from "vitest";

import type {
  Check,
  Engine,
  Symptom,
} from "../../../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../../../domain/rule-set/rule-set-name-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { checksPluginImportOf, projectedNamedChecksOf } from "./projected-checks.ts";

const WALKER_ENGINE: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const TEST_SWITCHED_OFF: Symptom = {
  ruleSet: "hone",
  name: "test-switched-off",
  title: "Test switched off",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const POSITIONAL_PARAMETERS: Symptom = {
  ruleSet: "hone",
  name: "positional-parameters",
  title: "Positional parameters",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  ruleSet: "hone",
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
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-27"),
    clause: clauseIdOf("skipped-tests"),
  },
  engines: [ESLINT_ENGINE],
  forms: [],
};

const NON_NULL_ASSERTIONS_CHECK: Check = {
  name: "non-null-assertions",
  symptom: CLAIMED_TYPE,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("non-null-assertions"),
  },
  engines: [ESLINT_ENGINE],
  forms: [],
};

const PARAMETER_COUNT_CHECK: Check = {
  name: "parameter-count",
  symptom: POSITIONAL_PARAMETERS,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-40"),
    clause: clauseIdOf("parameter-count"),
  },
  engines: [ESLINT_ENGINE],
  forms: [],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-27"),
    clause: clauseIdOf("test-body-logic"),
  },
  engines: [WALKER_ENGINE],
  forms: ["a-let"],
};

const PLUGIN_CHECKS: readonly Check[] = [
  SKIPPED_TESTS_CHECK,
  NON_NULL_ASSERTIONS_CHECK,
  PARAMETER_COUNT_CHECK,
  REBINDING_TEST_BODY,
];

const ESLINT = "eslint" as const;

const AUDIT = "walker" as const;

const PARAMETER_COUNT_BINDING: CheckBinding = {
  address: "positional-parameters#parameter-count",
  ruleSet: "hone",
  engine: ESLINT,
  anchor: { kind: "file" },
  pieceRoot: "/install/eslint/positional-parameters/parameter-count",
  settings: {
    pluginNamespace: "hone-cd40",
    pluginModule: "cd40/cd40.eslint-plugin.ts",
    rule: "max-params",
    options: [{ max: 2, countVoidThis: true }],
  },
  checkSettings: {},
  edition: editionOf("1"),
};

const SKIPPED_TESTS_BINDING: CheckBinding = {
  address: "test-switched-off#skipped-tests",
  ruleSet: "hone",
  engine: ESLINT,
  anchor: { kind: "file" },
  pieceRoot: "/install/eslint/test-switched-off/skipped-tests",
  settings: {
    pluginNamespace: "hone-cd27",
    pluginModule: "cd27/cd27.eslint-plugin.ts",
    rule: "skipped-tests",
  },
  checkSettings: {},
  edition: editionOf("1"),
};

const WALKER_BINDING: CheckBinding = {
  address: "rebinding#test-body",
  ruleSet: "hone",
  engine: AUDIT,
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/rebinding/test-body",
  settings: { module: "test-body-logic.ts" },
  checkSettings: {},
  edition: editionOf("1"),
};

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("projectedNamedChecksOf", () => {
  it("projects each ESLint binding's check under its rule id, with the piece's options, and no binding of another engine", () => {
    expect(
      projectedNamedChecksOf({
        checks: PLUGIN_CHECKS,
        bindings: [SKIPPED_TESTS_BINDING, WALKER_BINDING, PARAMETER_COUNT_BINDING],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: "hone",
          symptom: "test-switched-off",
          check: "skipped-tests",
          ruleId: "hone/test-switched-off#skipped-tests",
          options: [],
        },
        {
          ruleSet: "hone",
          symptom: "positional-parameters",
          check: "parameter-count",
          ruleId: "hone/positional-parameters#parameter-count",
          options: [{ max: 2, countVoidThis: true }],
        },
      ],
    });
  });

  it("refuses an ESLint binding whose settings are not an ESLint piece's, naming its piece", () => {
    expect(
      projectedNamedChecksOf({
        checks: PLUGIN_CHECKS,
        bindings: [{ ...SKIPPED_TESTS_BINDING, settings: { module: "skipped-tests.ts" } }],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: SKIPPED_TESTS_BINDING.pieceRoot },
    });
  });

  it("refuses an ESLint binding for a check only Walker runs", () => {
    expect(
      projectedNamedChecksOf({
        checks: PLUGIN_CHECKS,
        bindings: [{ ...WALKER_BINDING, engine: ESLINT, settings: SKIPPED_TESTS_BINDING.settings }],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "check-unknown", address: WALKER_BINDING.address },
    });
  });

  it("refuses a team’s attempt to occupy Hone’s reserved plugin namespace", () => {
    expect(
      projectedNamedChecksOf({
        checks: [SKIPPED_TESTS_CHECK],
        bindings: [
          {
            ...SKIPPED_TESTS_BINDING,
            ruleSet: { name: ruleSetNameOf("team") },
            settings: { pluginNamespace: "hone", pluginModule: "plugin.ts", rule: "no-skips" },
          },
        ],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: SKIPPED_TESTS_BINDING.pieceRoot },
    });
  });

  it("keeps a team's ESLint namespace and plugin module when projecting its named check", () => {
    expect(
      projectedNamedChecksOf({
        checks: [SKIPPED_TESTS_CHECK],
        bindings: [
          {
            address: "test-switched-off#skipped-tests",
            engine: "eslint",
            ruleSet: { name: ruleSetNameOf("team") },
            anchor: { kind: "file" },
            pieceRoot: "/repo/team",
            settings: { pluginNamespace: "team", pluginModule: "plugin.ts", rule: "no-skips" },
            checkSettings: {},
            edition: editionOf("1"),
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: { name: ruleSetNameOf("team") },
          symptom: "test-switched-off",
          check: "skipped-tests",
          ruleId: "team/no-skips",
          options: [],
          plugin: { namespace: "team", module: "plugin.ts", pieceRoot: "/repo/team" },
        },
      ],
    });
  });

  it("projects a selected check that has no version one clause", () => {
    expect(
      projectedNamedChecksOf({
        checks: [
          { name: "debug-call", symptom: { name: "leftover-debugging" }, engines: [ESLINT_ENGINE] },
          {
            name: "debug-statement",
            symptom: { name: "leftover-debugging" },
            engines: [ESLINT_ENGINE],
          },
        ],
        bindings: [
          {
            address: "leftover-debugging#debug-call",
            ruleSet: "hone",
            engine: "eslint",
            anchor: { kind: "file" },
            pieceRoot: "/install/pieces/leftover-debugging",
            settings: {
              pluginNamespace: "original",
              pluginModule: "plugin.ts",
              rule: "debug-call",
              options: [{ allowed: ["warn"] }],
            },
            checkSettings: {},
            edition: editionOf("1"),
          },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: "hone",
          symptom: "leftover-debugging",
          check: "debug-call",
          ruleId: "hone/leftover-debugging#debug-call",
          options: [{ allowed: ["warn"] }],
        },
      ],
    });
  });
});

describe("checksPluginImportOf", () => {
  it("imports the package's plugin export by name from a package install", () => {
    expect(
      checksPluginImportOf({
        path: PATH,
        importingDirectory: absoluteRootOf("/repo"),
        installRoot: absoluteRootOf("/repo/node_modules/@hailstails/hone"),
        install: {
          form: "package",
          root: "/repo/node_modules/@hailstails/hone",
          name: "@hailstails/hone",
        },
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

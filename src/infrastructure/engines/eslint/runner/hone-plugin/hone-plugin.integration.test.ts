import { assert, describe, expect, it } from "vitest";
import { symptomCatalogueOf } from "../../../../content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import SYMPTOMS from "../../../../../../rules/typescript/symptoms.json" with { type: "json" };
import { checkOfRuleId, eslintRuleIdsOf } from "./check-rule-id.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { SILENT_BOUNDARY } from "../../../../../../tests/eslint-major-boundary-stub.ts";
import { honePluginAt } from "./hone-plugin.ts";

const CATALOGUE = symptomCatalogueOf({ document: SYMPTOMS });

assert(CATALOGUE.outcome === "ok");

const path = createDefaultPathPort({});

const honePlugin = await honePluginAt({
  checks: CATALOGUE.value.checks,
  installRoot: absolutePathSchema.parse(path.join({ segments: [import.meta.dirname, "..", "..", "..", "..", "..", ".."] })),
  fileText: createDefaultFileTextPort({}),
  path,
  modules: createDefaultModuleLoaderPort({}),
  boundary: SILENT_BOUNDARY,
});

const ESLINT_CHECKS: readonly { readonly ruleId: string; readonly symptom: string; readonly check: string }[] = [
  { ruleId: "hone/untyped-value#explicit-any", symptom: "untyped-value", check: "explicit-any" },
  { ruleId: "hone/untyped-value#implicit-any-let", symptom: "untyped-value", check: "implicit-any-let" },
  { ruleId: "hone/claimed-type#non-null-assertions", symptom: "claimed-type", check: "non-null-assertions" },
  { ruleId: "hone/name-off-its-casing#naming-convention", symptom: "name-off-its-casing", check: "naming-convention" },
  { ruleId: "hone/name-off-its-casing#filename-case", symptom: "name-off-its-casing", check: "filename-case" },
  { ruleId: "hone/thrown-non-error#throw-only-error", symptom: "thrown-non-error", check: "throw-only-error" },
  { ruleId: "hone/authored-class-or-this#class-keyword", symptom: "authored-class-or-this", check: "class-keyword" },
  { ruleId: "hone/authored-class-or-this#static-members-only", symptom: "authored-class-or-this", check: "static-members-only" },
  { ruleId: "hone/test-switched-off#focused-tests", symptom: "test-switched-off", check: "focused-tests" },
  { ruleId: "hone/test-switched-off#skipped-tests", symptom: "test-switched-off", check: "skipped-tests" },
  { ruleId: "hone/positional-parameters#parameter-count", symptom: "positional-parameters", check: "parameter-count" },
  { ruleId: "hone/tangled-function#cognitive-complexity", symptom: "tangled-function", check: "cognitive-complexity" },
  { ruleId: "hone/long-function#function-length", symptom: "long-function", check: "function-length" },
  { ruleId: "hone/work-inside-a-condition#else-after-an-exit", symptom: "work-inside-a-condition", check: "else-after-an-exit" },
  { ruleId: "hone/rebinding#parameter-reassignment", symptom: "rebinding", check: "parameter-reassignment" },
];

describe("honePluginAt, over this repository's catalogue and pieces", () => {
  it("is the one plugin, named for its export", () => {
    expect(honePlugin).toMatchObject({ outcome: "ok", value: { meta: { name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" } } });
  });

  it("gives every check the catalogue runs on ESLint exactly one rule id", () => {
    expect(eslintRuleIdsOf({ checks: CATALOGUE.value.checks })).toEqual([
      "hone/untyped-value#explicit-any",
      "hone/untyped-value#implicit-any-let",
      "hone/claimed-type#non-null-assertions",
      "hone/name-off-its-casing#naming-convention",
      "hone/name-off-its-casing#filename-case",
      "hone/thrown-non-error#throw-only-error",
      "hone/authored-class-or-this#class-keyword",
      "hone/authored-class-or-this#static-members-only",
      "hone/test-switched-off#focused-tests",
      "hone/test-switched-off#skipped-tests",
      "hone/positional-parameters#parameter-count",
      "hone/tangled-function#cognitive-complexity",
      "hone/long-function#function-length",
      "hone/work-inside-a-condition#else-after-an-exit",
      "hone/rebinding#parameter-reassignment",
    ]);
  });

  it("holds a rule under every one of those ids and no other", () => {
    expect(honePlugin).toEqual({
      outcome: "ok",
      value: {
        meta: expect.anything(),
        rules: {
          "untyped-value#explicit-any": expect.anything(),
          "untyped-value#implicit-any-let": expect.anything(),
          "claimed-type#non-null-assertions": expect.anything(),
          "name-off-its-casing#naming-convention": expect.anything(),
          "name-off-its-casing#filename-case": expect.anything(),
          "thrown-non-error#throw-only-error": expect.anything(),
          "authored-class-or-this#class-keyword": expect.anything(),
          "authored-class-or-this#static-members-only": expect.anything(),
          "test-switched-off#focused-tests": expect.anything(),
          "test-switched-off#skipped-tests": expect.anything(),
          "positional-parameters#parameter-count": expect.anything(),
          "tangled-function#cognitive-complexity": expect.anything(),
          "long-function#function-length": expect.anything(),
          "work-inside-a-condition#else-after-an-exit": expect.anything(),
          "rebinding#parameter-reassignment": expect.anything(),
        },
      },
    });
  });

  it.each(ESLINT_CHECKS)("resolves $ruleId back to its check", ({ ruleId, symptom, check }) => {
    expect(checkOfRuleId({ checks: CATALOGUE.value.checks, ruleId })).toMatchObject({ found: "check", check: { name: check, symptom: { name: symptom } } });
  });
});

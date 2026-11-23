import { assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { readBoundCatalogue } from "../../src/infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import {
  checkOfRuleId,
  eslintRuleIdsOf,
} from "../../src/infrastructure/engines/eslint/runner/hone-plugin/check-rule-id.ts";
import { honePluginAt } from "../../src/infrastructure/engines/eslint/runner/hone-plugin/hone-plugin.ts";
import type { EslintMajorBoundary } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-major-boundary.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";

const SILENT_BOUNDARY: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: () => undefined,
  declarationText: "declare const projection: readonly unknown[];\nexport default projection;\n",
};

const REPOSITORY_ROOT = absolutePathSchema.parse(
  createDefaultPathPort({}).join({ segments: [import.meta.dirname, "..", ".."] }),
);

const CATALOGUE_HOLDING = readBoundCatalogue({
  ruleSet: "hone",
  inheritedRecordKinds: [],
  directory: createDefaultDirectoryPort({}),
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
  ruleSetRoot: REPOSITORY_ROOT,
  installRoot: REPOSITORY_ROOT,
});

assert(CATALOGUE_HOLDING.outcome === "ok", "this repository's catalogue reads");

assert(CATALOGUE_HOLDING.value.held === "catalogue", "this repository holds a catalogue");

const CATALOGUE = CATALOGUE_HOLDING.value.catalogue;

const path = createDefaultPathPort({});

const honePlugin = await honePluginAt({
  checks: CATALOGUE.checks,
  installRoot: absolutePathSchema.parse(path.join({ segments: [import.meta.dirname, "..", ".."] })),
  fileText: createDefaultFileTextPort({}),
  path,
  modules: createDefaultModuleLoaderPort({}),
  boundary: SILENT_BOUNDARY,
});

const ESLINT_CHECKS: readonly {
  readonly ruleId: string;
  readonly symptom: string;
  readonly check: string;
}[] = [
  { ruleId: "hone/untyped-value#explicit-any", symptom: "untyped-value", check: "explicit-any" },
  {
    ruleId: "hone/untyped-value#implicit-any-let",
    symptom: "untyped-value",
    check: "implicit-any-let",
  },
  {
    ruleId: "hone/claimed-type#non-null-assertions",
    symptom: "claimed-type",
    check: "non-null-assertions",
  },
  {
    ruleId: "hone/name-off-its-casing#naming-convention",
    symptom: "name-off-its-casing",
    check: "naming-convention",
  },
  {
    ruleId: "hone/name-off-its-casing#filename-case",
    symptom: "name-off-its-casing",
    check: "filename-case",
  },
  {
    ruleId: "hone/thrown-non-error#throw-only-error",
    symptom: "thrown-non-error",
    check: "throw-only-error",
  },
  {
    ruleId: "hone/authored-class-or-this#class-keyword",
    symptom: "authored-class-or-this",
    check: "class-keyword",
  },
  {
    ruleId: "hone/authored-class-or-this#static-members-only",
    symptom: "authored-class-or-this",
    check: "static-members-only",
  },
  {
    ruleId: "hone/test-switched-off#focused-tests",
    symptom: "test-switched-off",
    check: "focused-tests",
  },
  {
    ruleId: "hone/test-switched-off#skipped-tests",
    symptom: "test-switched-off",
    check: "skipped-tests",
  },
  {
    ruleId: "hone/positional-parameters#parameter-count",
    symptom: "positional-parameters",
    check: "parameter-count",
  },
  {
    ruleId: "hone/tangled-function#cognitive-complexity",
    symptom: "tangled-function",
    check: "cognitive-complexity",
  },
  {
    ruleId: "hone/long-function#function-length",
    symptom: "long-function",
    check: "function-length",
  },
  {
    ruleId: "hone/work-inside-a-condition#else-after-an-exit",
    symptom: "work-inside-a-condition",
    check: "else-after-an-exit",
  },
  {
    ruleId: "hone/rebinding#parameter-reassignment",
    symptom: "rebinding",
    check: "parameter-reassignment",
  },
];

describe("honePluginAt, over this repository's catalogue and pieces", () => {
  it("is the one plugin, named for its export", () => {
    expect(honePlugin).toMatchObject({
      outcome: "ok",
      value: { meta: { name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" } },
    });
  });

  it("gives every check the catalogue runs on ESLint exactly one rule id", () => {
    expect(eslintRuleIdsOf({ checks: CATALOGUE.checks })).toEqual([
      "hone/authored-class-or-this#class-keyword",
      "hone/authored-class-or-this#static-members-only",
      "hone/claimed-type#non-null-assertions",
      "hone/long-function#function-length",
      "hone/name-off-its-casing#filename-case",
      "hone/name-off-its-casing#naming-convention",
      "hone/positional-parameters#parameter-count",
      "hone/rebinding#parameter-reassignment",
      "hone/tangled-function#cognitive-complexity",
      "hone/test-switched-off#focused-tests",
      "hone/test-switched-off#skipped-tests",
      "hone/thrown-non-error#throw-only-error",
      "hone/untyped-value#explicit-any",
      "hone/untyped-value#implicit-any-let",
      "hone/work-inside-a-condition#else-after-an-exit",
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
    expect(checkOfRuleId({ checks: CATALOGUE.checks, ruleId })).toMatchObject({
      found: "check",
      check: { name: check, symptom: { name: symptom } },
    });
  });
});

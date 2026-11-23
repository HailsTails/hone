import { describe, expect, it } from "vitest";

import { checkConformanceOf, checkUnderTestOf, type CheckRequest } from "./testing.ts";

const requests: readonly CheckRequest[] = [
  { ruleSet: "hone", check: "authored-class-or-this#class-keyword", engine: "eslint" },
  { ruleSet: "hone", check: "authored-class-or-this#static-members-only", engine: "eslint" },
  { ruleSet: "hone", check: "claimed-type#non-null-assertions", engine: "eslint" },
  { ruleSet: "hone", check: "long-function#function-length", engine: "eslint" },
  { ruleSet: "hone", check: "name-off-its-casing#filename-case", engine: "eslint" },
  { ruleSet: "hone", check: "name-off-its-casing#naming-convention", engine: "eslint" },
  { ruleSet: "hone", check: "positional-parameters#parameter-count", engine: "eslint" },
  { ruleSet: "hone", check: "rebinding#parameter-reassignment", engine: "eslint" },
  { ruleSet: "hone", check: "tangled-function#cognitive-complexity", engine: "eslint" },
  { ruleSet: "hone", check: "test-switched-off#focused-tests", engine: "eslint" },
  { ruleSet: "hone", check: "test-switched-off#skipped-tests", engine: "eslint" },
  { ruleSet: "hone", check: "thrown-non-error#throw-only-error", engine: "eslint" },
  { ruleSet: "hone", check: "untyped-value#explicit-any", engine: "eslint" },
  { ruleSet: "hone", check: "untyped-value#implicit-any-let", engine: "eslint" },
  { ruleSet: "hone", check: "work-inside-a-condition#else-after-an-exit", engine: "eslint" },
  { ruleSet: "hone", check: "authored-class-or-this#class-keyword", engine: "walker" },
  { ruleSet: "hone", check: "boolean-in-a-signature#boolean-annotation", engine: "walker" },
  { ruleSet: "hone", check: "branch-in-a-test#test-body", engine: "walker" },
  { ruleSet: "hone", check: "claimed-type#cast-to-any", engine: "walker" },
  { ruleSet: "hone", check: "claimed-type#unlisted-cast-site", engine: "walker" },
  { ruleSet: "hone", check: "computed-value-in-a-test#test-body", engine: "walker" },
  { ruleSet: "hone", check: "date-used-directly#clock-sources", engine: "walker" },
  { ruleSet: "hone", check: "default-on-a-closed-union#default-arm", engine: "walker" },
  { ruleSet: "hone", check: "double-with-a-body#logic-in-a-passed-function", engine: "walker" },
  { ruleSet: "hone", check: "double-with-a-body#stub-implementation", engine: "walker" },
  { ruleSet: "hone", check: "drawer-path#drawer-names", engine: "walker" },
  {
    ruleSet: "hone",
    check: "inherited-environment-in-a-subprocess#git-spawn-environment",
    engine: "walker",
  },
  { ruleSet: "hone", check: "loop-keyword#loop-statement", engine: "walker" },
  { ruleSet: "hone", check: "module-or-global-patched#module-mock-call", engine: "walker" },
  { ruleSet: "hone", check: "outside-import-past-a-boundary#import-or-require", engine: "walker" },
  { ruleSet: "hone", check: "rebinding#test-body", engine: "walker" },
  { ruleSet: "hone", check: "shorthand-name#identifier-names", engine: "walker" },
  { ruleSet: "hone", check: "strictness-weakened#exact-optional-property-types", engine: "walker" },
  {
    ruleSet: "hone",
    check: "strictness-weakened#no-fallthrough-cases-in-switch",
    engine: "walker",
  },
  { ruleSet: "hone", check: "strictness-weakened#no-implicit-override", engine: "walker" },
  {
    ruleSet: "hone",
    check: "strictness-weakened#no-property-access-from-index-signature",
    engine: "walker",
  },
  { ruleSet: "hone", check: "strictness-weakened#no-unchecked-indexed-access", engine: "walker" },
  { ruleSet: "hone", check: "strictness-weakened#strict", engine: "walker" },
  {
    ruleSet: "hone",
    check: "strictness-weakened#use-unknown-in-catch-variables",
    engine: "walker",
  },
  { ruleSet: "hone", check: "text-past-its-reader#test-body", engine: "walker" },
  { ruleSet: "hone", check: "throw-or-catch-in-a-test#throw-statement", engine: "walker" },
  { ruleSet: "hone", check: "throw-or-catch-in-a-test#try-block", engine: "walker" },
  { ruleSet: "hone", check: "type-derived-from-code#factory-return-types", engine: "walker" },
  { ruleSet: "hone", check: "unit-without-a-running-test#companion-test-file", engine: "walker" },
  { ruleSet: "hone", check: "untracked-escape#directive-pointers", engine: "walker" },
  { ruleSet: "hone", check: "write-into-a-parameter#parameter-mutation", engine: "walker" },
];

describe("installed named check examples", () => {
  it.each(requests)("$engine $check conforms to its named examples", async (request) => {
    expect(checkUnderTestOf(request)).toMatchObject({
      outcome: "ok",
      value: {
        ...request,
        examples: expect.arrayContaining([expect.objectContaining({ source: expect.any(String) })]),
      },
    });
    await expect(checkConformanceOf(request)).resolves.toEqual({ outcome: "ok", value: [] });
  });
});

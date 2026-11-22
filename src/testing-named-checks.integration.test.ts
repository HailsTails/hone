import { describe, expect, it } from "vitest";

import { checkConformanceOf, checkUnderTestOf, type CheckRequest } from "./testing.ts";

const requests: readonly CheckRequest[] = [
  { check: "authored-class-or-this#class-keyword", engine: "eslint" },
  { check: "authored-class-or-this#static-members-only", engine: "eslint" },
  { check: "claimed-type#non-null-assertions", engine: "eslint" },
  { check: "long-function#function-length", engine: "eslint" },
  { check: "name-off-its-casing#filename-case", engine: "eslint" },
  { check: "name-off-its-casing#naming-convention", engine: "eslint" },
  { check: "positional-parameters#parameter-count", engine: "eslint" },
  { check: "rebinding#parameter-reassignment", engine: "eslint" },
  { check: "tangled-function#cognitive-complexity", engine: "eslint" },
  { check: "test-switched-off#focused-tests", engine: "eslint" },
  { check: "test-switched-off#skipped-tests", engine: "eslint" },
  { check: "thrown-non-error#throw-only-error", engine: "eslint" },
  { check: "untyped-value#explicit-any", engine: "eslint" },
  { check: "untyped-value#implicit-any-let", engine: "eslint" },
  { check: "work-inside-a-condition#else-after-an-exit", engine: "eslint" },
  { check: "authored-class-or-this#class-keyword", engine: "walker" },
  { check: "boolean-in-a-signature#boolean-annotation", engine: "walker" },
  { check: "branch-in-a-test#test-body", engine: "walker" },
  { check: "claimed-type#cast-to-any", engine: "walker" },
  { check: "claimed-type#unlisted-cast-site", engine: "walker" },
  { check: "computed-value-in-a-test#test-body", engine: "walker" },
  { check: "date-used-directly#clock-sources", engine: "walker" },
  { check: "default-on-a-closed-union#default-arm", engine: "walker" },
  { check: "double-with-a-body#logic-in-a-passed-function", engine: "walker" },
  { check: "double-with-a-body#stub-implementation", engine: "walker" },
  { check: "drawer-path#drawer-names", engine: "walker" },
  { check: "inherited-environment-in-a-subprocess#git-spawn-environment", engine: "walker" },
  { check: "loop-keyword#loop-statement", engine: "walker" },
  { check: "module-or-global-patched#module-mock-call", engine: "walker" },
  { check: "outside-import-past-a-boundary#import-or-require", engine: "walker" },
  { check: "rebinding#test-body", engine: "walker" },
  { check: "shorthand-name#identifier-names", engine: "walker" },
  { check: "strictness-weakened#exact-optional-property-types", engine: "walker" },
  { check: "strictness-weakened#no-fallthrough-cases-in-switch", engine: "walker" },
  { check: "strictness-weakened#no-implicit-override", engine: "walker" },
  { check: "strictness-weakened#no-property-access-from-index-signature", engine: "walker" },
  { check: "strictness-weakened#no-unchecked-indexed-access", engine: "walker" },
  { check: "strictness-weakened#strict", engine: "walker" },
  { check: "strictness-weakened#use-unknown-in-catch-variables", engine: "walker" },
  { check: "text-past-its-reader#test-body", engine: "walker" },
  { check: "throw-or-catch-in-a-test#throw-statement", engine: "walker" },
  { check: "throw-or-catch-in-a-test#try-block", engine: "walker" },
  { check: "type-derived-from-code#factory-return-types", engine: "walker" },
  { check: "unit-without-a-running-test#companion-test-file", engine: "walker" },
  { check: "untracked-escape#directive-pointers", engine: "walker" },
  { check: "write-into-a-parameter#parameter-mutation", engine: "walker" },
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

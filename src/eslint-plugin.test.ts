import { describe, expect, it } from "vitest";

import plugin from "./eslint-plugin.ts";

describe("@hailstails/hone/eslint-plugin", () => {
  it("exports as its default the one plugin built at this install's root, holding every ESLint check's rule", () => {
    expect(plugin).toEqual({
      meta: { name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" },
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
        "wide-input#unread-parameter": expect.anything(),
        "work-inside-a-condition#else-after-an-exit": expect.anything(),
        "rebinding#parameter-reassignment": expect.anything(),
      },
    });
  });
});

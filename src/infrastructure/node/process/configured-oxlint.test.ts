import { describe, expect, it } from "vitest";

import { readEffectiveChecks } from "./configured-oxlint.ts";

describe("readEffectiveChecks", () => {
  it("preserves selected override order and ignores unrelated rules and plugins", () => {
    const rule = "typescript/no-explicit-any";
    const applicableFiles = ["**/*.ts"];
    const exceptionFiles = ["./debt.ts"];

    const effective = readEffectiveChecks({
      ids: new Set([rule]),
      namespaces: new Set(["hone"]),
      config: {
        jsPlugins: [
          { name: "adopter", specifier: "adopter-plugin" },
          { name: "hone", specifier: "@hailstails/hone/check.js" },
        ],
        overrides: [
          { files: applicableFiles, rules: { [rule]: "error", "no-undef": "warn" } },
          { files: applicableFiles, rules: { "no-unused-vars": "warn" } },
          { files: exceptionFiles, rules: { [rule]: "off" } },
        ],
      },
    });

    expect(effective).toEqual({
      plugins: [{ name: "hone", specifier: "@hailstails/hone/check.js" }],
      overrides: [
        { files: applicableFiles, rules: { [rule]: "error" } },
        { files: exceptionFiles, rules: { [rule]: "off" } },
      ],
    });
  });
});

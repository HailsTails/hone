import { describe, expect, it } from "vitest";

import { readEffectiveChecks, removeProjectedOffSwitches } from "./configured-oxlint.ts";

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

describe("removeProjectedOffSwitches", () => {
  it("keeps the effective config except for the selected rules in the projected off switches", () => {
    const rule = "max-params";
    const base = { files: ["**/*.ts"], rules: { [rule]: ["deny", { max: 2 }] } };
    const earlier = { files: ["old.ts"], rules: { [rule]: "allow" } };
    const config = removeProjectedOffSwitches({
      config: {
        ignorePatterns: ["generated/"],
        overrides: [
          earlier,
          base,
          { files: ["debt.ts"], rules: { [rule]: "allow", "no-undef": "warn" } },
          { files: ["fixtures/*"], rules: { "no-unused-vars": "allow" } },
        ],
      },
      ids: new Set([rule]),
      projectedOverrides: 2,
    });

    expect(config).toEqual({
      ignorePatterns: ["generated/"],
      overrides: [
        earlier,
        base,
        { files: ["debt.ts"], rules: { "no-undef": "warn" } },
        { files: ["fixtures/*"], rules: { "no-unused-vars": "allow" } },
      ],
    });
  });
});

import { describe, expect, it } from "vitest";
import { eslintPieceSettingsSchema } from "../../runner/pieces/eslint-piece-settings-schema.ts";
import classKeyword from "./piece.json" with { type: "json" };
import staticMembersOnly from "../static-members-only/piece.json" with { type: "json" };

describe("authored class ESLint declarations", () => {
  it("names the class authoring rule", () => {
    expect(eslintPieceSettingsSchema.safeParse(classKeyword.settings)).toEqual({
      success: true,
      data: { pluginNamespace: "hone", pluginModule: "eslint-plugin.ts", rule: "no-class-authoring" },
    });
  });

  it("reuses the class plugin for the check for classes with only static members", () => {
    expect(staticMembersOnly.implementation).toEqual({ symptom: "authored-class-or-this", check: "class-keyword" });
    expect(eslintPieceSettingsSchema.safeParse(staticMembersOnly.settings)).toEqual({
      success: true,
      data: {
        pluginNamespace: "hone",
        pluginModule: "eslint-plugin.ts",
        rule: "no-extraneous-class",
        options: [{ allowConstructorOnly: true, allowEmpty: true, allowStaticOnly: false, allowWithDecorator: true }],
      },
    });
  });
});

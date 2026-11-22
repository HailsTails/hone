import { describe, expect, it } from "vitest";

import type { ClauseSettingDeclarations } from "../../rule-set/rule-set-types.ts";
import { defaultClauseSettings } from "./default-clause-settings.ts";

const DECLARATIONS: ClauseSettingDeclarations = {
  confinedPackages: { default: [] },
  convention: { default: "camelCase", choices: ["camelCase", "snake_case"] },
};

describe("defaultClauseSettings", () => {
  it("takes each declared key's default", () => {
    expect(defaultClauseSettings({ declarations: DECLARATIONS })).toEqual({
      confinedPackages: [],
      convention: "camelCase",
    });
  });
});

import { describe, expect, it } from "vitest";
import type { ClauseSettingValues } from "../../domain/runner/runner-module-types.ts";
import type { ClauseSettingDeclarations } from "../../domain/rule-set/rule-set-types.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { clauseSettingsSchema, settledClauseSettings } from "./clause-settings.ts";

const ADDRESS = clauseAddressSchema.parse("CD-6#naming-convention");

const DECLARATIONS: ClauseSettingDeclarations = {
  confinedPackages: { default: [] },
  convention: { default: "camelCase", choices: ["camelCase", "snake_case"] },
};

describe("clauseSettingsSchema", () => {
  it("reads each clause address with its settings object", () => {
    expect(clauseSettingsSchema.parse({ "CD-19#import-boundaries": { confinedPackages: ["eslint"] } })).toEqual([
      [{ ruleSet: "hone", discipline: "CD-19", clause: "import-boundaries" }, { confinedPackages: ["eslint"] }],
    ]);
  });

  it.each([
    { name: "a key that is not a clause address", settings: { "CD-19 import-boundaries": {} } },
    { name: "settings that are not an object", settings: { "CD-19#import-boundaries": "eslint" } },
  ])("refuses $name", ({ settings }) => {
    expect(clauseSettingsSchema.safeParse(settings).success).toBe(false);
  });
});

describe("settledClauseSettings", () => {
  it("is the declared defaults when the repository gives none", () => {
    expect(settledClauseSettings({ address: ADDRESS, declarations: DECLARATIONS, given: undefined })).toEqual({
      outcome: "ok",
      value: { confinedPackages: [], convention: "camelCase" },
    });
  });

  it("replaces only the keys the repository gives", () => {
    expect(settledClauseSettings({ address: ADDRESS, declarations: DECLARATIONS, given: { convention: "snake_case" } })).toEqual({
      outcome: "ok",
      value: { confinedPackages: [], convention: "snake_case" },
    });
  });

  it.each<{
    readonly name: string;
    readonly declarations: ClauseSettingDeclarations;
    readonly given: ClauseSettingValues;
    readonly detail: string;
  }>([
    { name: "a piece that declares no keys", declarations: {}, given: { convention: "camelCase" }, detail: "its piece takes no settings" },
    {
      name: "an undeclared key",
      declarations: DECLARATIONS,
      given: { naming: "camelCase" },
      detail: "its piece takes no naming; it takes confinedPackages, convention",
    },
    {
      name: "a value of another JSON kind than the default",
      declarations: DECLARATIONS,
      given: { confinedPackages: "eslint" },
      detail: "confinedPackages must be an array, as its default is",
    },
    {
      name: "a value outside the choices",
      declarations: DECLARATIONS,
      given: { convention: "kebab-case" },
      detail: 'convention must be one of "camelCase", "snake_case"',
    },
  ])("refuses $name, naming the clause, the key and what is accepted", ({ declarations, given, detail }) => {
    expect(settledClauseSettings({ address: ADDRESS, declarations, given })).toEqual({
      outcome: "failed",
      error: `clauseSettings for CD-6#naming-convention: ${detail}`,
    });
  });
});

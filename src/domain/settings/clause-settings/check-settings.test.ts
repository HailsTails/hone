import { describe, expect, it } from "vitest";

import { editionOf } from "../../rule-set/edition-of.ts";
import type { ClauseEditions } from "../../rule-set/edition-types.ts";
import type { ClauseSettingDeclarations } from "../../rule-set/rule-set-types.ts";
import type { GivenCheckSettings } from "../settings-file.ts";
import { type SettledCheckSettings, settledCheckSettings } from "./check-settings.ts";

const FIRST = editionOf("1");

const SECOND = editionOf("2");

const TWO_EDITIONS: ClauseEditions = { declared: [FIRST, SECOND], default: FIRST, latest: SECOND };

const CONFINED: ClauseSettingDeclarations = { confinedOutsideDependencies: { default: [] } };

const MODE: ClauseSettingDeclarations = {
  mode: { default: "strict", choices: ["strict", "loose"] },
};

const ADDRESS = "outside-import-past-a-boundary#import-or-require";

const givenOn = (values: GivenCheckSettings["values"]): GivenCheckSettings => ({
  address: { ruleSet: "hone", check: ADDRESS },
  values,
});

describe("settledCheckSettings", () => {
  it("gives the piece's defaults and its default edition when no settings are given", () => {
    expect(
      settledCheckSettings({
        given: undefined,
        declarations: CONFINED,
        editions: TWO_EDITIONS,
        checkEditions: "pinned",
      }),
    ).toEqual<{ readonly outcome: "ok"; readonly value: SettledCheckSettings }>({
      outcome: "ok",
      value: { clauseSettings: { confinedOutsideDependencies: [] }, edition: FIRST },
    });
  });

  it("gives the latest edition when the file takes the latest", () => {
    expect(
      settledCheckSettings({
        given: undefined,
        declarations: {},
        editions: TWO_EDITIONS,
        checkEditions: "latest",
      }),
    ).toEqual({ outcome: "ok", value: { clauseSettings: {}, edition: SECOND } });
  });

  it("pins the edition given and leaves it out of the piece's settings", () => {
    expect(
      settledCheckSettings({
        given: givenOn({ edition: "2" }),
        declarations: {},
        editions: TWO_EDITIONS,
        checkEditions: "pinned",
      }),
    ).toEqual({ outcome: "ok", value: { clauseSettings: {}, edition: SECOND } });
  });

  it("hands the confined outside dependencies to the piece under the name it reads", () => {
    expect(
      settledCheckSettings({
        given: givenOn({ confinedOutsideDependencies: ["uuid"] }),
        declarations: CONFINED,
        editions: TWO_EDITIONS,
        checkEditions: "pinned",
      }),
    ).toEqual({
      outcome: "ok",
      value: { clauseSettings: { confinedOutsideDependencies: ["uuid"] }, edition: FIRST },
    });
  });

  type RefusalRow = {
    readonly name: string;
    readonly given: { readonly [key: string]: string | readonly string[] | number };
    readonly declarations: ClauseSettingDeclarations;
    readonly refusal: string;
  };

  it.each<RefusalRow>([
    {
      name: "an edition the piece does not declare",
      given: { edition: "3" },
      declarations: {},
      refusal: `checkSettings for ${ADDRESS}: edition must be one of "1", "2"`,
    },
    {
      name: "a setting on a check whose piece takes none",
      given: { mode: "strict" },
      declarations: {},
      refusal: `checkSettings for ${ADDRESS}: its check takes no settings`,
    },
    {
      name: "a setting the piece does not declare, naming those it takes in version 2's words",
      given: { mode: "strict" },
      declarations: CONFINED,
      refusal: `checkSettings for ${ADDRESS}: its check takes no mode; it takes confinedOutsideDependencies`,
    },
    {
      name: "a setting of another kind than its default",
      given: { confinedOutsideDependencies: 3 },
      declarations: CONFINED,
      refusal: `checkSettings for ${ADDRESS}: confinedOutsideDependencies must be an array, as its default is`,
    },
    {
      name: "a setting outside its choices",
      given: { mode: "lax" },
      declarations: MODE,
      refusal: `checkSettings for ${ADDRESS}: mode must be one of "strict", "loose"`,
    },
  ])("refuses $name", ({ given, declarations, refusal }) => {
    expect(
      settledCheckSettings({
        given: givenOn(given),
        declarations,
        editions: TWO_EDITIONS,
        checkEditions: "pinned",
      }),
    ).toEqual({
      outcome: "failed",
      error: refusal,
    });
  });
});

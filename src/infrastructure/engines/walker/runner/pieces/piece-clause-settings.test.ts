import { describe, expect, it } from "vitest";

import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type {
  CheckSettingValues,
  CheckBinding,
} from "../../../../../domain/runner/check-binding.ts";
import { stringListCheckSettings } from "./piece-check-settings.ts";

const CLAUSE_WITH_NO_SETTINGS: CheckBinding = {
  address: "example#import-boundaries",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-19",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "a.ts" },
};

const clauseWith = (request: { readonly checkSettings: CheckSettingValues }): CheckBinding => ({
  ...CLAUSE_WITH_NO_SETTINGS,
  checkSettings: request.checkSettings,
});

describe("stringListCheckSettings", () => {
  it("reads each named string list from the binding's settings, apart from the mechanism settings", () => {
    expect(
      stringListCheckSettings({
        binding: clauseWith({ checkSettings: { allowed: ["x"], denied: [] } }),
        keys: ["allowed", "denied"],
      }),
    ).toEqual({ outcome: "ok", value: { allowed: ["x"], denied: [] } });
  });

  it.each<{ readonly name: string; readonly binding: CheckBinding }>([
    { name: "empty", binding: CLAUSE_WITH_NO_SETTINGS },
    { name: "missing a named list", binding: clauseWith({ checkSettings: { allowed: [] } }) },
    {
      name: "holding an unnamed setting",
      binding: clauseWith({ checkSettings: { allowed: [], denied: [], extra: [] } }),
    },
    {
      name: "holding a list that is not of strings",
      binding: clauseWith({ checkSettings: { allowed: [1], denied: [] } }),
    },
    {
      name: "holding an empty string",
      binding: clauseWith({ checkSettings: { allowed: [""], denied: [] } }),
    },
  ])("is piece-invalid, naming the binding, when the binding settings are $name", ({ binding }) => {
    expect(stringListCheckSettings({ binding, keys: ["allowed", "denied"] })).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: "/install/mechanisms/audit/CD-19",
        detail: expect.stringContaining(
          "the checkSettings of example#import-boundaries are malformed",
        ),
      },
    });
  });
});

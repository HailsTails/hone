import { describe, expect, it } from "vitest";
import type { ClauseSettingValues, RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { stringListClauseSettings } from "./piece-clause-settings.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";

const CLAUSE_WITH_NO_SETTINGS: RunnerClause = {
  address: clauseAddressSchema.parse("CD-19#import-boundaries"),
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-19",
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "a.ts" },
};

const clauseWith = (request: { readonly clauseSettings: ClauseSettingValues }): RunnerClause => ({
  ...CLAUSE_WITH_NO_SETTINGS,
  clauseSettings: request.clauseSettings,
});

describe("stringListClauseSettings", () => {
  it("reads each named string list from the clause's settings, apart from the mechanism settings", () => {
    expect(
      stringListClauseSettings({
        clause: clauseWith({ clauseSettings: { allowed: ["x"], denied: [] } }),
        keys: ["allowed", "denied"],
      }),
    ).toEqual({ outcome: "ok", value: { allowed: ["x"], denied: [] } });
  });

  it.each<{ readonly name: string; readonly clause: RunnerClause }>([
    { name: "empty", clause: CLAUSE_WITH_NO_SETTINGS },
    { name: "missing a named list", clause: clauseWith({ clauseSettings: { allowed: [] } }) },
    { name: "holding an unnamed setting", clause: clauseWith({ clauseSettings: { allowed: [], denied: [], extra: [] } }) },
    { name: "holding a list that is not of strings", clause: clauseWith({ clauseSettings: { allowed: [1], denied: [] } }) },
    { name: "holding an empty string", clause: clauseWith({ clauseSettings: { allowed: [""], denied: [] } }) },
  ])("is piece-invalid, naming the clause, when the clause settings are $name", ({ clause }) => {
    expect(stringListClauseSettings({ clause, keys: ["allowed", "denied"] })).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: "/install/mechanisms/audit/CD-19",
        detail: expect.stringContaining("the clauseSettings of CD-19#import-boundaries are malformed"),
      },
    });
  });
});

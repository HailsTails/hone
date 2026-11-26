import { describe, expect, it } from "vitest";

import type { Check } from "../../language-layer/symptom-catalogue.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { mapSelectionToVersionTwo, readConfinedPackages } from "./selection-mapping.ts";

describe("mapSelectionToVersionTwo", () => {
  it("maps a version 1 selection to its version 2 settings", () => {
    const importBoundaries = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-19"),
      clause: clauseIdOf("import-boundaries"),
    };
    const importOrRequire: Check = {
      name: "import-or-require",
      symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      engines: [{ name: "walker" }],
      forms: [],
      findingSpecifics: [],
    };

    const mapped = mapSelectionToVersionTwo({
      selection: {
        version: 1,
        ruleSets: [],
        clauses: [[importBoundaries, { state: "run", mechanism: "walker" }]],
        exclude: [],
        eslintConfigRoots: [],
        fileExceptionWhyChains: "required",
        reportOutput: "full",
        assessment: { forfeiture: "this-run" },
        clauseSettings: [[importBoundaries, { confinedPackages: ["uuid"] }]],
        checkEditions: "pinned",
      },
      clauseChecks: new Map([["CD-19#import-boundaries", [importOrRequire]]]),
    });

    expect(mapped).toEqual({
      outcome: "ok",
      value: {
        exclude: [],
        ruleSets: [],
        checks: [
          {
            address: { ruleSet: "hone", check: "outside-import-past-a-boundary#import-or-require" },
            state: { state: "run", engine: "walker" },
          },
        ],
        checkSettings: [
          {
            address: { ruleSet: "hone", check: "outside-import-past-a-boundary#import-or-require" },
            values: { confinedOutsideDependencies: ["uuid"] },
          },
        ],
        forfeiture: "this-run",
        reportOutput: "full",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [],
        eslintProjectionKind: "mjs",
        conventions: {
          conventions: {
            generated: [],
            layers: [],
            testFiles: { suffixes: ["test", "spec"], folders: [] },
          },
          declared: [],
        },
      },
    });
  });

  it("refuses a selection whose clause has no check", () => {
    const mapped = mapSelectionToVersionTwo({
      selection: {
        version: 1,
        ruleSets: [],
        clauses: [
          [
            {
              ruleSet: TOOL_RULE_SET,
              discipline: disciplineIdOf("CD-19"),
              clause: clauseIdOf("import-boundaries"),
            },
            { state: "run", mechanism: "walker" },
          ],
        ],
        exclude: [],
        eslintConfigRoots: [],
        fileExceptionWhyChains: "required",
        reportOutput: "full",
        assessment: { forfeiture: "this-run" },
        clauseSettings: [],
        checkEditions: "pinned",
      },
      clauseChecks: new Map(),
    });

    expect(mapped).toEqual({
      outcome: "failed",
      error: [{ kind: "clause-without-check", clause: "CD-19#import-boundaries" }],
    });
  });
});

describe("readConfinedPackages", () => {
  it("lists the packages a selection confines, leaving the clause's edition pin aside", () => {
    const importBoundaries = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-19"),
      clause: clauseIdOf("import-boundaries"),
    };

    const confined = readConfinedPackages({
      selection: {
        version: 1,
        ruleSets: [],
        clauses: [[importBoundaries, { state: "run", mechanism: "walker" }]],
        exclude: [],
        eslintConfigRoots: [],
        fileExceptionWhyChains: "required",
        reportOutput: "full",
        assessment: { forfeiture: "this-run" },
        clauseSettings: [[importBoundaries, { confinedPackages: ["uuid", "zod"], edition: "1" }]],
        checkEditions: "pinned",
      },
    });

    expect(confined).toEqual({ confined: "listed", packages: ["uuid", "zod"] });
  });

  it("lists no packages for a selection that confines none", () => {
    const loops = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-15"),
      clause: clauseIdOf("loops"),
    };

    const confined = readConfinedPackages({
      selection: {
        version: 1,
        ruleSets: [],
        clauses: [[loops, { state: "run", mechanism: "walker" }]],
        exclude: [],
        eslintConfigRoots: [],
        fileExceptionWhyChains: "required",
        reportOutput: "full",
        assessment: { forfeiture: "this-run" },
        clauseSettings: [[loops, { edition: "1" }]],
        checkEditions: "pinned",
      },
    });

    expect(confined).toEqual({ confined: "listed", packages: [] });
  });

  it("reads every confinedPackages that is not a list of package names as unreadable, naming each clause and carrying the readable packages", () => {
    const importBoundaries = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-19"),
      clause: clauseIdOf("import-boundaries"),
    };
    const loops = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-15"),
      clause: clauseIdOf("loops"),
    };
    const names = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-1"),
      clause: clauseIdOf("names"),
    };

    const confined = readConfinedPackages({
      selection: {
        version: 1,
        ruleSets: [],
        clauses: [[importBoundaries, { state: "run", mechanism: "walker" }]],
        exclude: [],
        eslintConfigRoots: [],
        fileExceptionWhyChains: "required",
        reportOutput: "full",
        assessment: { forfeiture: "this-run" },
        clauseSettings: [
          [importBoundaries, { confinedPackages: ["uuid", 3] }],
          [loops, { confinedPackages: "zod" }],
          [names, { confinedPackages: ["eslint"] }],
        ],
        checkEditions: "pinned",
      },
    });

    expect(confined).toEqual({
      confined: "unreadable",
      clauses: [importBoundaries, loops],
      packages: ["eslint"],
    });
  });
});

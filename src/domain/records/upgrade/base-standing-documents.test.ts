import { describe, expect, it } from "vitest";

import { createRuleContent } from "../../language-layer/rule-content.ts";
import type { Check, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { createBaseEntryStanding, mapStandingsToHeldDocuments } from "./base-standing-documents.ts";

describe("createBaseEntryStanding", () => {
  it("holds an authorised location of a base with no version 1 settings as its record for node modules alone", () => {
    const importBoundaries = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-19"),
      clause: clauseIdOf("import-boundaries"),
    };
    const outsideImport: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: {
            name: "authorised-location",
            title: "Authorised location",
            phrase: "an authorised location",
            todaysFormat: "authorised-location",
          },
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const importOrRequire: Check = {
      name: "import-or-require",
      symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      clause: importBoundaries,
      engines: [{ name: "walker" }],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    const entry = { kind: "authorised-location", clause: "CD-19#import-boundaries" };

    const standing = createBaseEntryStanding({
      selection: { presence: "absent-from-base" },
      input: {
        kind: "authorised-location",
        record: { clause: importBoundaries, file: repoPathOf("src/ids.ts") },
        entry,
        answer: { reach: "whole-clause" },
      },
      clauseChecks: new Map([["CD-19#import-boundaries", [importOrRequire]]]),
      content: createRuleContent({ catalogues: [{ symptoms: [outsideImport] }] }),
    });

    expect(standing).toEqual({
      standing: "held-at-base",
      documents: [
        {
          file: "hone-records/authorised-locations/outside-import-past-a-boundary.json",
          version: 2,
          records: [
            {
              answers: "outside-import-past-a-boundary#import-or-require",
              file: "src/ids.ts",
              outsideParty: "node:",
              carried: entry,
            },
          ],
        },
      ],
    });
  });

  it("holds an authorised location as a record for each package the base's selection confined, then one for node modules", () => {
    const importBoundaries = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-19"),
      clause: clauseIdOf("import-boundaries"),
    };
    const outsideImport: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: {
            name: "authorised-location",
            title: "Authorised location",
            phrase: "an authorised location",
            todaysFormat: "authorised-location",
          },
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const importOrRequire: Check = {
      name: "import-or-require",
      symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      clause: importBoundaries,
      engines: [{ name: "walker" }],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    const entry = { kind: "authorised-location", clause: "CD-19#import-boundaries" };

    const standing = createBaseEntryStanding({
      selection: {
        presence: "present-in-base",
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
      },
      input: {
        kind: "authorised-location",
        record: { clause: importBoundaries, file: repoPathOf("src/ids.ts") },
        entry,
        answer: { reach: "whole-clause" },
      },
      clauseChecks: new Map([["CD-19#import-boundaries", [importOrRequire]]]),
      content: createRuleContent({ catalogues: [{ symptoms: [outsideImport] }] }),
    });

    expect(standing).toEqual({
      standing: "held-at-base",
      documents: [
        {
          file: "hone-records/authorised-locations/outside-import-past-a-boundary.json",
          version: 2,
          records: [
            {
              answers: "outside-import-past-a-boundary#import-or-require",
              file: "src/ids.ts",
              outsideParty: "uuid",
              carried: entry,
            },
            {
              answers: "outside-import-past-a-boundary#import-or-require",
              file: "src/ids.ts",
              outsideParty: "node:",
              carried: entry,
            },
          ],
        },
      ],
    });
  });

  it("holds no record that needs a party at a base whose confinedPackages is not a list of names", () => {
    const importBoundaries = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-19"),
      clause: clauseIdOf("import-boundaries"),
    };
    const outsideImport: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: {
            name: "authorised-location",
            title: "Authorised location",
            phrase: "an authorised location",
            todaysFormat: "authorised-location",
          },
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const importOrRequire: Check = {
      name: "import-or-require",
      symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      clause: importBoundaries,
      engines: [{ name: "walker" }],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    const entry = { kind: "authorised-location", clause: "CD-19#import-boundaries" };

    const standing = createBaseEntryStanding({
      selection: {
        presence: "present-in-base",
        selection: {
          version: 1,
          ruleSets: [],
          clauses: [[importBoundaries, { state: "run", mechanism: "walker" }]],
          exclude: [],
          eslintConfigRoots: [],
          fileExceptionWhyChains: "required",
          reportOutput: "full",
          assessment: { forfeiture: "this-run" },
          clauseSettings: [[importBoundaries, { confinedPackages: ["uuid", 3] }]],
          checkEditions: "pinned",
        },
      },
      input: {
        kind: "authorised-location",
        record: { clause: importBoundaries, file: repoPathOf("src/ids.ts") },
        entry,
        answer: { reach: "whole-clause" },
      },
      clauseChecks: new Map([["CD-19#import-boundaries", [importOrRequire]]]),
      content: createRuleContent({ catalogues: [{ symptoms: [outsideImport] }] }),
    });

    expect(standing).toEqual({ standing: "held-without-parties-at-base", documents: [] });
  });

  it("holds no record that needs a party at a base whose disciplines.json is unreadable, keeping the records that need none", () => {
    const loops = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-15"),
      clause: clauseIdOf("loops"),
    };
    const loopKeyword: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "loop-keyword",
      title: "Loop keyword",
      seen: "`for` or `while`.",
      mayIndicate: [],
      breachUsuallySits: "in the unit",
      recipes: [],
      correctUses: [],
    };
    const loopKeywordLoops: Check = {
      name: "loops",
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
      page: "loop-keyword/loops.md",
      clause: loops,
      engines: [{ name: "walker" }],
      forms: [],
      findingSpecifics: [],
    };
    const entry = { kind: "authorised-location", clause: "CD-15#loops" };

    const standing = createBaseEntryStanding({
      selection: { presence: "unreadable-in-base" },
      input: {
        kind: "authorised-location",
        record: { clause: loops, file: repoPathOf("src/a.ts") },
        entry,
        answer: { reach: "whole-clause" },
      },
      clauseChecks: new Map([["CD-15#loops", [loopKeywordLoops]]]),
      content: createRuleContent({ catalogues: [{ symptoms: [loopKeyword] }] }),
    });

    expect(standing).toEqual({
      standing: "held-without-parties-at-base",
      documents: [
        {
          file: "hone-records/authorised-locations/loop-keyword.json",
          version: 2,
          records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: entry }],
        },
      ],
    });
  });

  it("holds an authorised location when the base's selection holds a clause the head removed", () => {
    const loops = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-15"),
      clause: clauseIdOf("loops"),
    };
    const removed = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-99"),
      clause: clauseIdOf("removed"),
    };
    const loopKeyword: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "loop-keyword",
      title: "Loop keyword",
      seen: "`for` or `while`.",
      mayIndicate: [],
      breachUsuallySits: "in the unit",
      recipes: [],
      correctUses: [],
    };
    const loopKeywordLoops: Check = {
      name: "loops",
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
      page: "loop-keyword/loops.md",
      clause: loops,
      engines: [{ name: "walker" }],
      forms: [],
      findingSpecifics: [],
    };
    const entry = { kind: "authorised-location", clause: "CD-15#loops" };

    const standing = createBaseEntryStanding({
      selection: {
        presence: "present-in-base",
        selection: {
          version: 1,
          ruleSets: [],
          clauses: [
            [loops, { state: "run", mechanism: "walker" }],
            [removed, { state: "run", mechanism: "walker" }],
          ],
          exclude: [],
          eslintConfigRoots: [],
          fileExceptionWhyChains: "required",
          reportOutput: "full",
          assessment: { forfeiture: "this-run" },
          clauseSettings: [],
          checkEditions: "pinned",
        },
      },
      input: {
        kind: "authorised-location",
        record: { clause: loops, file: repoPathOf("src/a.ts") },
        entry,
        answer: { reach: "whole-clause" },
      },
      clauseChecks: new Map([["CD-15#loops", [loopKeywordLoops]]]),
      content: createRuleContent({ catalogues: [{ symptoms: [loopKeyword] }] }),
    });

    expect(standing).toEqual({
      standing: "held-at-base",
      documents: [
        {
          file: "hone-records/authorised-locations/loop-keyword.json",
          version: 2,
          records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: entry }],
        },
      ],
    });
  });

  it("holds nothing at the base for an authorised location the records mapping refuses", () => {
    const standing = createBaseEntryStanding({
      selection: { presence: "absent-from-base" },
      input: {
        kind: "authorised-location",
        record: {
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-15"),
            clause: clauseIdOf("loops"),
          },
          file: repoPathOf("src/a.ts"),
        },
        entry: { kind: "authorised-location", clause: "CD-15#loops" },
        answer: { reach: "whole-clause" },
      },
      clauseChecks: new Map(),
      content: createRuleContent({ catalogues: [] }),
    });

    expect(standing).toEqual({ standing: "not-held-at-base" });
  });
});

describe("mapStandingsToHeldDocuments", () => {
  it("files the records of each held entry, with or without parties, under their file in the order held, leaving out what is not held at base", () => {
    const loops = { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts" };
    const later = { kind: "authorised-location", clause: "CD-15#loops", file: "src/b.ts" };
    const rebinding = { kind: "authorised-location", clause: "CD-27#test-body-logic" };

    const documents = mapStandingsToHeldDocuments({
      standings: [
        {
          standing: "held-at-base",
          documents: [
            {
              file: repoPathOf("hone-records/authorised-locations/rebinding.json"),
              version: 2,
              records: [{ answers: "rebinding#test-body", file: "src/a.ts", carried: rebinding }],
            },
            {
              file: repoPathOf("hone-records/authorised-locations/loop-keyword.json"),
              version: 2,
              records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: loops }],
            },
          ],
        },
        { standing: "not-held-at-base" },
        {
          standing: "held-without-parties-at-base",
          documents: [
            {
              file: repoPathOf("hone-records/authorised-locations/loop-keyword.json"),
              version: 2,
              records: [{ answers: "loop-keyword#loops", file: "src/b.ts", carried: later }],
            },
          ],
        },
      ],
    });

    expect(documents).toEqual([
      {
        file: "hone-records/authorised-locations/loop-keyword.json",
        version: 2,
        records: [
          { answers: "loop-keyword#loops", file: "src/a.ts", carried: loops },
          { answers: "loop-keyword#loops", file: "src/b.ts", carried: later },
        ],
      },
      {
        file: "hone-records/authorised-locations/rebinding.json",
        version: 2,
        records: [{ answers: "rebinding#test-body", file: "src/a.ts", carried: rebinding }],
      },
    ]);
  });
});

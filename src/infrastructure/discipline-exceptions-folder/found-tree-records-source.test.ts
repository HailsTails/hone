import { describe, expect, it, vi } from "vitest";

import type { GitPort } from "../../application/ports/git-port.ts";
import type { FoundTreeExceptions } from "../../application/ports/records/exception-repository.ts";
import type { RecordsSource } from "../../application/ports/records/records-source.ts";
import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type { StructuralExceptionEntry } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import type { RecordsDocument } from "../../domain/records/hone-records/hone-record.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import { foundTreeRecordsSourceOver } from "./found-tree-records-source.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const LOOP_KEYWORD: Symptom = {
  ruleSet: "hone",
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  ruleSet: "hone",
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
  findingSpecifics: [],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  page: "rebinding/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
  findingSpecifics: [],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { form: "a-for-loop", symptom: LOOP_KEYWORD },
          { form: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: LAYERING_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

const ENTRY = {
  kind: "authorised-location",
  clause: "CD-15#loops",
  file: "src/a.ts",
  reason: "kept",
} as const;

const FOUND_TREE = "the tree the upgrade found";

const AUTHORISED_DOCUMENT: RecordsDocument = {
  file: repoPathOf("hone-records/authorised-locations/loop-keyword.json"),
  document: {
    version: 2,
    records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: ENTRY }],
  },
};

const WRITTEN_DOCUMENT: RecordsDocument = {
  file: repoPathOf("hone-records/debt/loop-keyword.json"),
  document: { version: 2, records: [] },
};

const entriesAtFoundTree = (): FoundTreeExceptions => ({
  readAt: vi.fn<FoundTreeExceptions["readAt"]>().mockReturnValue({ outcome: "ok", value: [ENTRY] }),
});

const sourceReading = (): RecordsSource => ({
  read: vi
    .fn<RecordsSource["read"]>()
    .mockReturnValue({ outcome: "ok", value: [WRITTEN_DOCUMENT] }),
  readAt: vi.fn<RecordsSource["readAt"]>(),
});

describe("foundTreeRecordsSourceOver", () => {
  it("reads the records the working tree holds as they are", () => {
    const source = foundTreeRecordsSourceOver({
      source: sourceReading(),
      exceptions: entriesAtFoundTree(),
      git: {
        textInBase: vi
          .fn<GitPort["textInBase"]>()
          .mockReturnValue({ outcome: "ok", value: { presence: "absent-from-base" } }),
      },
      repoRoot: absoluteRootOf("/repo"),
      catalogue: SETTINGS_CATALOGUE,
    });
    expect(source.read()).toEqual({ outcome: "ok", value: [WRITTEN_DOCUMENT] });
  });

  it("holds at the base the records the version 1 entries at the found tree become, and asks the records folder for nothing at the base", () => {
    const underlying = sourceReading();
    const exceptions = entriesAtFoundTree();
    const git: Pick<GitPort, "textInBase"> = {
      textInBase: vi
        .fn<GitPort["textInBase"]>()
        .mockReturnValue({ outcome: "ok", value: { presence: "absent-from-base" } }),
    };
    const repoRoot = absoluteRootOf("/repo");
    const source = foundTreeRecordsSourceOver({
      source: underlying,
      exceptions,
      git,
      repoRoot,
      catalogue: SETTINGS_CATALOGUE,
    });
    expect({
      atBase: source.readAt({ revision: FOUND_TREE }),
      askedRecords: vi.mocked(underlying.readAt).mock.calls,
      askedEntries: vi.mocked(exceptions.readAt).mock.calls,
      askedSelection: vi.mocked(git.textInBase).mock.calls,
    }).toEqual({
      atBase: { outcome: "ok", value: [AUTHORISED_DOCUMENT] },
      askedRecords: [],
      askedEntries: [[{ revision: FOUND_TREE }]],
      askedSelection: [[{ repoRoot, baseRevision: FOUND_TREE, file: "disciplines.json" }]],
    });
  });

  it("holds at the base a team's location and carve-out at the check its catalogue names for their clause", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const directConsole: Symptom = { ...LOOP_KEYWORD, ruleSet: acme, name: "direct-console" };
    const consoleCalls: Check = {
      name: "console-calls",
      symptom: directConsole,
      page: "direct-console/console-calls.md",
      clause: {
        ruleSet: acme,
        discipline: disciplineIdOf("ACME-1"),
        clause: clauseIdOf("console-calls"),
      },
      engines: [WALKER],
      forms: [],
      findingSpecifics: [],
    };
    const location: StructuralExceptionEntry = {
      kind: "authorised-location",
      clause: "acme/ACME-1#console-calls",
      file: "src/a.ts",
      reason: "the one place",
    };
    const carveOut: StructuralExceptionEntry = {
      kind: "file-carve-out",
      clause: "acme/ACME-1#console-calls",
      file: "src/b.ts",
    };
    const source = foundTreeRecordsSourceOver({
      source: sourceReading(),
      exceptions: {
        readAt: vi
          .fn<FoundTreeExceptions["readAt"]>()
          .mockReturnValue({ outcome: "ok", value: [location, carveOut] }),
      },
      git: {
        textInBase: vi
          .fn<GitPort["textInBase"]>()
          .mockReturnValue({ outcome: "ok", value: { presence: "absent-from-base" } }),
      },
      repoRoot: absoluteRootOf("/repo"),
      catalogue: { ...SETTINGS_CATALOGUE, symptoms: [directConsole], checks: [consoleCalls] },
    });

    const atBase = source.readAt({ revision: FOUND_TREE });

    expect(atBase).toEqual({
      outcome: "ok",
      value: [
        {
          file: "hone-records/acme/authorised-locations/direct-console.json",
          document: {
            version: 2,
            records: [
              { answers: "direct-console#console-calls", file: "src/a.ts", carried: location },
            ],
          },
        },
        {
          file: "hone-records/acme/debt/direct-console.json",
          document: {
            version: 2,
            records: [
              { answers: "direct-console#console-calls", file: "src/b.ts", carried: carveOut },
            ],
          },
        },
      ],
    });
  });

  it("holds at the base a record for each package the found tree's disciplines.json confined", () => {
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
          kind: AUTHORISED_LOCATION_KIND,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const importOrRequire: Check = {
      name: "import-or-require",
      symptom: outsideImport,
      page: "outside-import-past-a-boundary/import-or-require.md",
      clause: importBoundaries,
      engines: [WALKER],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    const entry: StructuralExceptionEntry = {
      kind: "authorised-location",
      clause: "CD-19#import-boundaries",
      file: "src/ids.ts",
      reason: "wraps uuid",
    };
    const source = foundTreeRecordsSourceOver({
      source: sourceReading(),
      exceptions: {
        readAt: vi
          .fn<FoundTreeExceptions["readAt"]>()
          .mockReturnValue({ outcome: "ok", value: [entry] }),
      },
      git: {
        textInBase: vi.fn<GitPort["textInBase"]>().mockReturnValue({
          outcome: "ok",
          value: {
            presence: "present-in-base",
            text: '{ "version": 1, "ruleSets": {}, "clauses": { "CD-19#import-boundaries": "walker" }, "clauseSettings": { "CD-19#import-boundaries": { "confinedPackages": ["uuid"] } } }',
          },
        }),
      },
      repoRoot: absoluteRootOf("/repo"),
      catalogue: {
        ...SETTINGS_CATALOGUE,
        symptoms: [outsideImport],
        clauses: [
          { clause: importBoundaries, sight: { kind: "one-symptom", symptom: outsideImport } },
        ],
        checks: [importOrRequire],
      },
    });

    const atBase = source.readAt({ revision: FOUND_TREE });

    expect(atBase).toEqual({
      outcome: "ok",
      value: [
        {
          file: "hone-records/authorised-locations/outside-import-past-a-boundary.json",
          document: {
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
        },
      ],
    });
  });
});

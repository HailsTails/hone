import { assert, describe, expect, it, vi } from "vitest";

import type { GitPort } from "../../application/ports/git-port.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
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
import type { RecordsDocument } from "../../domain/records/hone-records/hone-record.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";
import { carriedStandingOf } from "../hone-records-folder/reading/carried-standing.ts";
import {
  baseStandingRecordsSource,
  versionOneAwareRecordsSourceOf,
} from "./base-standing-records-source.ts";
import type { VersionOneEntries } from "./version-one-entries.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT: Engine = { name: "eslint" };

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

const REBINDING: Symptom = { ...LOOP_KEYWORD, name: "rebinding", title: "Rebinding" };

const LOOPS_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT],
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
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [WALKER, ESLINT],
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

const LOOP_KEYWORD_AUTHORISED = repoPathOf("hone-records/authorised-locations/loop-keyword.json");

const REBINDING_AUTHORISED = repoPathOf("hone-records/authorised-locations/rebinding.json");

const LOOPS_ENTRY = {
  kind: "authorised-location",
  clause: "CD-15#loops",
  file: "src/a.ts",
  reason: "kept",
} as const;

const TEST_BODY_ENTRY = {
  kind: "authorised-location",
  clause: "CD-27#test-body-logic",
  file: "src/a.ts",
  reason: "the tests need it",
} as const;

const LOOPS_DOCUMENT: RecordsDocument = {
  file: LOOP_KEYWORD_AUTHORISED,
  document: {
    version: 2,
    records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: LOOPS_ENTRY }],
  },
};

const NO_DOCUMENTS = { outcome: "ok", value: [] } as const;

const sourceReadingBase = (request: {
  readonly base: ReturnType<RecordsSource["readAt"]>;
}): RecordsSource => ({
  read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: [] }),
  readAt: vi.fn<RecordsSource["readAt"]>().mockReturnValue(request.base),
});

const entriesAtBase = (request: {
  readonly read: ReturnType<VersionOneEntries["atBase"]>;
}): VersionOneEntries => ({
  atBase: vi.fn<VersionOneEntries["atBase"]>().mockReturnValue(request.read),
  selectionAtBase: vi
    .fn<VersionOneEntries["selectionAtBase"]>()
    .mockReturnValue({ outcome: "ok", value: { presence: "absent-from-base" } }),
});

const readAtBaseHolding = (request: {
  readonly entries: ReturnType<VersionOneEntries["atBase"]>;
  readonly base: ReturnType<RecordsSource["readAt"]>;
}) =>
  baseStandingRecordsSource({
    source: sourceReadingBase({ base: request.base }),
    entries: entriesAtBase({ read: request.entries }),
    catalogue: SETTINGS_CATALOGUE,
  }).readAt({ revision: "origin/main" });

const readAtBaseWith = (request: { readonly entries: ReturnType<VersionOneEntries["atBase"]> }) =>
  readAtBaseHolding({ entries: request.entries, base: NO_DOCUMENTS });

describe("baseStandingRecordsSource writing the records the base's version 1 entries would have become", () => {
  it("writes an authorised location as a record at the one check of its clause, carrying the entry word for word", () => {
    const read = readAtBaseWith({
      entries: { outcome: "ok", value: [{ entry: LOOPS_ENTRY, carried: LOOPS_ENTRY }] },
    });

    expect(read).toEqual({
      outcome: "ok",
      value: [LOOPS_DOCUMENT],
    });
  });

  it("writes an authorised location of a two-check clause as a record at each of its checks, in the file of each check's symptom", () => {
    const read = readAtBaseWith({
      entries: { outcome: "ok", value: [{ entry: TEST_BODY_ENTRY, carried: TEST_BODY_ENTRY }] },
    });

    expect(read).toEqual({
      outcome: "ok",
      value: [
        {
          file: LOOP_KEYWORD_AUTHORISED,
          document: {
            version: 2,
            records: [
              { answers: "loop-keyword#test-body", file: "src/a.ts", carried: TEST_BODY_ENTRY },
            ],
          },
        },
        {
          file: REBINDING_AUTHORISED,
          document: {
            version: 2,
            records: [
              { answers: "rebinding#test-body", file: "src/a.ts", carried: TEST_BODY_ENTRY },
            ],
          },
        },
      ],
    });
  });

  it("writes nothing at the checks of another clause, so a record there finds nothing at the base to match", () => {
    const read = readAtBaseWith({
      entries: { outcome: "ok", value: [{ entry: LOOPS_ENTRY, carried: LOOPS_ENTRY }] },
    });

    expect(read).not.toEqual({
      outcome: "ok",
      value: expect.arrayContaining([expect.objectContaining({ file: REBINDING_AUTHORISED })]),
    });
  });

  it("writes the record at the entry's own file, so a record at another file finds nothing at the base to match", () => {
    expect(
      readAtBaseWith({
        entries: {
          outcome: "ok",
          value: [
            {
              entry: { ...LOOPS_ENTRY, file: "src/b.ts" },
              carried: { ...LOOPS_ENTRY, file: "src/b.ts" },
            },
          ],
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          file: LOOP_KEYWORD_AUTHORISED,
          document: {
            version: 2,
            records: [
              {
                answers: "loop-keyword#loops",
                file: "src/b.ts",
                carried: { ...LOOPS_ENTRY, file: "src/b.ts" },
              },
            ],
          },
        },
      ],
    });
  });

  it("writes one record for each entry the base held, in the order they were read", () => {
    expect(
      readAtBaseWith({
        entries: {
          outcome: "ok",
          value: [
            { entry: LOOPS_ENTRY, carried: LOOPS_ENTRY },
            {
              entry: { ...LOOPS_ENTRY, file: "src/b.ts" },
              carried: { ...LOOPS_ENTRY, file: "src/b.ts" },
            },
          ],
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          file: LOOP_KEYWORD_AUTHORISED,
          document: {
            version: 2,
            records: [
              { answers: "loop-keyword#loops", file: "src/a.ts", carried: LOOPS_ENTRY },
              {
                answers: "loop-keyword#loops",
                file: "src/b.ts",
                carried: { ...LOOPS_ENTRY, file: "src/b.ts" },
              },
            ],
          },
        },
      ],
    });
  });

  it("writes a file carve-out as a debt record at each check of its clause, in the debt file of the check's symptom", () => {
    const carveOut = {
      kind: "file-carve-out",
      clause: "CD-15#loops",
      file: "src/a.ts",
      reason: "legacy loop",
      provenance: { kind: "inherited-debt", source: "old", decision: "keep" },
    } as const;

    const read = readAtBaseWith({
      entries: { outcome: "ok", value: [{ entry: carveOut, carried: carveOut }] },
    });

    expect(read).toEqual({
      outcome: "ok",
      value: [
        {
          file: "hone-records/debt/loop-keyword.json",
          document: {
            version: 2,
            records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: carveOut }],
          },
        },
      ],
    });
  });

  it("writes nothing for a clause-wide carve-out", () => {
    expect(
      readAtBaseWith({
        entries: {
          outcome: "ok",
          value: [
            {
              entry: {
                kind: "clause-wide-carve-out",
                clause: "CD-15#loops",
                reason: "generated",
                whyChain: "kept",
              },
              carried: {
                kind: "clause-wide-carve-out",
                clause: "CD-15#loops",
                reason: "generated",
                whyChain: "kept",
              },
            },
          ],
        },
      }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("holds nothing at the base for an authorised location whose clause has no check in the catalogue", () => {
    expect(
      readAtBaseWith({
        entries: {
          outcome: "ok",
          value: [
            {
              entry: { ...LOOPS_ENTRY, clause: "CD-99#unknown" },
              carried: { ...LOOPS_ENTRY, clause: "CD-99#unknown" },
            },
          ],
        },
      }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("holds nothing at the base for an authorised location at a check whose symptom no catalogue holds", () => {
    const symptomUnheldCatalogue: SymptomCatalogue = {
      ...SETTINGS_CATALOGUE,
      symptoms: [REBINDING],
      checks: [LOOP_KEYWORD_LOOPS],
    };
    const source = baseStandingRecordsSource({
      source: sourceReadingBase({ base: NO_DOCUMENTS }),
      entries: entriesAtBase({
        read: { outcome: "ok", value: [{ entry: LOOPS_ENTRY, carried: LOOPS_ENTRY }] },
      }),
      catalogue: symptomUnheldCatalogue,
    });

    const read = source.readAt({ revision: "origin/main" });

    expect(read).toEqual(NO_DOCUMENTS);
  });

  it("writes nothing for an entry whose clause or file does not parse", () => {
    expect(
      readAtBaseWith({
        entries: {
          outcome: "ok",
          value: [
            {
              entry: { ...LOOPS_ENTRY, clause: "not a clause" },
              carried: { ...LOOPS_ENTRY, clause: "not a clause" },
            },
            {
              entry: { ...LOOPS_ENTRY, file: "/absolute.ts" },
              carried: { ...LOOPS_ENTRY, file: "/absolute.ts" },
            },
          ],
        },
      }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("still writes the entries that map when another entry of the base does not", () => {
    expect(
      readAtBaseWith({
        entries: {
          outcome: "ok",
          value: [
            {
              entry: { ...LOOPS_ENTRY, clause: "CD-99#unknown" },
              carried: { ...LOOPS_ENTRY, clause: "CD-99#unknown" },
            },
            { entry: LOOPS_ENTRY, carried: LOOPS_ENTRY },
          ],
        },
      }),
    ).toEqual({ outcome: "ok", value: [LOOPS_DOCUMENT] });
  });
});

describe("baseStandingRecordsSource beside the records the base already holds", () => {
  it("leaves a file the base already holds as a version 2 document as the base holds it", () => {
    const held: RecordsDocument = {
      file: LOOP_KEYWORD_AUTHORISED,
      document: { version: 2, records: [] },
    };
    expect(
      readAtBaseHolding({
        entries: { outcome: "ok", value: [{ entry: LOOPS_ENTRY, carried: LOOPS_ENTRY }] },
        base: { outcome: "ok", value: [held] },
      }),
    ).toEqual({ outcome: "ok", value: [held] });
  });

  it("keeps the documents of other files the base holds beside the written one", () => {
    const held: RecordsDocument = {
      file: REBINDING_AUTHORISED,
      document: { version: 2, records: [] },
    };
    expect(
      readAtBaseHolding({
        entries: { outcome: "ok", value: [{ entry: LOOPS_ENTRY, carried: LOOPS_ENTRY }] },
        base: { outcome: "ok", value: [held] },
      }),
    ).toEqual({
      outcome: "ok",
      value: [held, LOOPS_DOCUMENT],
    });
  });

  it("fails as the source did when it cannot read the base, and reads no entries", () => {
    expect(
      readAtBaseHolding({
        entries: { outcome: "ok", value: [{ entry: LOOPS_ENTRY, carried: LOOPS_ENTRY }] },
        base: {
          outcome: "failed",
          error: { kind: "git-failed", command: "git ls-tree", detail: "unknown revision" },
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git ls-tree", detail: "unknown revision" },
    });
  });

  it("fails with the git failure that stopped the version 1 entries being read at the base, never treating them as absent", () => {
    expect(
      readAtBaseWith({
        entries: {
          outcome: "failed",
          error: { kind: "git-failed", command: "git show", detail: "bad object" },
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git show", detail: "bad object" },
    });
  });

  it("reads the head as the source does", () => {
    const source = sourceReadingBase({ base: NO_DOCUMENTS });
    expect(
      baseStandingRecordsSource({
        source,
        entries: entriesAtBase({ read: NO_DOCUMENTS }),
        catalogue: SETTINGS_CATALOGUE,
      }).read,
    ).toBe(source.read);
  });
});

describe("baseStandingRecordsSource and what a carried record stands on", () => {
  const stands = (request: { readonly entry: Parameters<typeof carriedStandingOf>[0]["entry"] }) =>
    carriedStandingOf({
      base: { measured: "yes", documents: [LOOPS_DOCUMENT] },
      file: LOOP_KEYWORD_AUTHORISED,
      entry: request.entry,
    });

  it("establishes the record the upgrade wrote from the entry, on its check and its file", () => {
    expect(
      stands({ entry: { answers: "loop-keyword#loops", file: "src/a.ts", carried: LOOPS_ENTRY } }),
    ).toEqual({ outcome: "ok", value: "established" });
  });

  it("refuses the same entry carried on another check", () => {
    expect(
      stands({ entry: { answers: "rebinding#test-body", file: "src/a.ts", carried: LOOPS_ENTRY } }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "carried-changed-since-base" }],
    });
  });

  it("refuses the same entry carried at another file", () => {
    expect(
      stands({
        entry: { answers: "loop-keyword#loops", file: "src/other.ts", carried: LOOPS_ENTRY },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "carried-changed-since-base" }],
    });
  });

  it("refuses a debt record with a note the base never held, even on the entry's check and file", () => {
    expect(
      stands({
        entry: {
          answers: "loop-keyword#loops",
          file: "src/a.ts",
          note: "a new reason",
          carried: LOOPS_ENTRY,
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "carried-changed-since-base" }],
    });
  });

  it("refuses the entry edited since the base", () => {
    expect(
      stands({
        entry: {
          answers: "loop-keyword#loops",
          file: "src/a.ts",
          carried: { ...LOOPS_ENTRY, reason: "edited" },
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "carried-changed-since-base" }],
    });
  });
});

describe("baseStandingRecordsSource establishing the carried debt of the base's file carve-outs", () => {
  const CARVE_OUT = {
    kind: "file-carve-out",
    clause: "CD-15#loops",
    file: "src/a.ts",
    reason: "legacy loop",
    whyChain: ["a", "b", "c", "d", "e"],
  };

  const DEBT_FILE = repoPathOf("hone-records/debt/loop-keyword.json");

  const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/loop-keyword.json");

  const HEAD_DEBT = { answers: "loop-keyword#loops", file: "src/a.ts", carried: CARVE_OUT };

  const BASE_DEBT: RecordsDocument = {
    file: DEBT_FILE,
    document: { version: 2, records: [HEAD_DEBT] },
  };

  const standingAtBase = (request: {
    readonly file: typeof DEBT_FILE;
    readonly entry: typeof HEAD_DEBT & { readonly note?: string };
  }) =>
    carriedStandingOf({
      base: { measured: "yes", documents: [BASE_DEBT] },
      file: request.file,
      entry: request.entry,
    });

  const CHANGED = { outcome: "failed", error: [{ kind: "carried-changed-since-base" }] };

  it("writes the base the debt record its own carve-out entry would have been carried as, in the debt file of the symptom", () => {
    const read = readAtBaseWith({
      entries: {
        outcome: "ok",
        value: [{ entry: { ...CARVE_OUT, kind: "file-carve-out" }, carried: CARVE_OUT }],
      },
    });

    expect(read).toEqual({
      outcome: "ok",
      value: [BASE_DEBT],
    });
  });

  it("reads a head debt record equal to it as established", () => {
    expect(standingAtBase({ file: DEBT_FILE, entry: HEAD_DEBT })).toEqual({
      outcome: "ok",
      value: "established",
    });
  });

  it("reads a head debt record with a note the base never held as changed since base", () => {
    expect(
      standingAtBase({ file: DEBT_FILE, entry: { ...HEAD_DEBT, note: "written at head" } }),
    ).toEqual(CHANGED);
  });

  it("reads the same record filed as an authorised location as changed since base, the entry being a carve-out", () => {
    expect(standingAtBase({ file: AUTHORISED_FILE, entry: HEAD_DEBT })).toEqual(CHANGED);
  });

  it("reads a head debt record whose carried entry was edited as changed since base", () => {
    expect(
      standingAtBase({
        file: DEBT_FILE,
        entry: { ...HEAD_DEBT, carried: { ...CARVE_OUT, reason: "edited" } },
      }),
    ).toEqual(CHANGED);
  });

  it("reads a whole-symptom head debt record as changed since base", () => {
    expect(
      standingAtBase({ file: DEBT_FILE, entry: { ...HEAD_DEBT, answers: "loop-keyword" } }),
    ).toEqual(CHANGED);
  });

  it("leaves a debt file the base already holds as a version 2 document as the base holds it", () => {
    const held: RecordsDocument = { file: DEBT_FILE, document: { version: 2, records: [] } };
    expect(
      readAtBaseHolding({
        entries: {
          outcome: "ok",
          value: [{ entry: { ...CARVE_OUT, kind: "file-carve-out" }, carried: CARVE_OUT }],
        },
        base: { outcome: "ok", value: [held] },
      }),
    ).toEqual({ outcome: "ok", value: [held] });
  });
});

describe("versionOneAwareRecordsSourceOf", () => {
  it("builds the source for a repository from the factory it wraps, the version 1 repository of the same root and the catalogue given", () => {
    const repoRoot = absoluteRootOf("/repo");
    const repository: Pick<ExceptionRepository, "readAt"> = {
      readAt: vi
        .fn<ExceptionRepository["readAt"]>()
        .mockReturnValue({ outcome: "ok", value: [LOOPS_ENTRY] }),
    };
    const exceptionRepositoryOf = vi
      .fn<
        (request: { readonly repoRoot: typeof repoRoot }) => Pick<ExceptionRepository, "readAt">
      >()
      .mockReturnValue(repository);
    const createSource = versionOneAwareRecordsSourceOf({
      recordsSourceOf: () => sourceReadingBase({ base: NO_DOCUMENTS }),
      exceptionRepositoryOf,
    });
    const source = createSource({
      fileText: { exists: vi.fn(), read: vi.fn() },
      directory: { list: vi.fn() },
      git: {
        textInBase: vi
          .fn<GitPort["textInBase"]>()
          .mockReturnValue({ outcome: "ok", value: { presence: "absent-from-base" } }),
      },
      gitTree: { pathsAt: vi.fn() },
      repoRoot,
      catalogue: SETTINGS_CATALOGUE,
    });
    expect(source.readAt({ revision: "origin/main" })).toEqual({
      outcome: "ok",
      value: [LOOPS_DOCUMENT],
    });
    expect(exceptionRepositoryOf).toHaveBeenCalledWith({ repoRoot });
  });
});

describe("baseStandingRecordsSource carrying the outside parties the base's version 1 settings confined", () => {
  it("still writes the base's entries when its selection holds a clause the head removed", () => {
    const source = baseStandingRecordsSource({
      source: {
        read: vi.fn<RecordsSource["read"]>(),
        readAt: vi.fn<RecordsSource["readAt"]>().mockReturnValue({ outcome: "ok", value: [] }),
      },
      entries: {
        atBase: vi.fn<VersionOneEntries["atBase"]>().mockReturnValue({
          outcome: "ok",
          value: [{ entry: LOOPS_ENTRY, carried: LOOPS_ENTRY }],
        }),
        selectionAtBase: vi.fn<VersionOneEntries["selectionAtBase"]>().mockReturnValue({
          outcome: "ok",
          value: {
            presence: "present-in-base",
            selection: {
              version: 1,
              ruleSets: [],
              clauses: [
                [LOOPS_CLAUSE, { state: "run", mechanism: "walker" }],
                [
                  {
                    ruleSet: TOOL_RULE_SET,
                    discipline: disciplineIdOf("CD-99"),
                    clause: clauseIdOf("removed"),
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
          },
        }),
      },
      catalogue: SETTINGS_CATALOGUE,
    });

    const read = source.readAt({ revision: "origin/main" });

    expect(read).toEqual({ outcome: "ok", value: [LOOPS_DOCUMENT] });
  });

  it("gives a head record for a package the base did not confine nothing at the base to stand on", () => {
    const entry = {
      kind: "authorised-location",
      clause: "CD-19#import-boundaries",
      file: "src/ids.ts",
      reason: "wraps uuid",
    };
    const file = repoPathOf(
      "hone-records/authorised-locations/outside-import-past-a-boundary.json",
    );
    const base: RecordsDocument = {
      file,
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
    };

    const standing = carriedStandingOf({
      base: { measured: "yes", documents: [base] },
      file,
      entry: {
        answers: "outside-import-past-a-boundary#import-or-require",
        file: "src/ids.ts",
        outsideParty: "zod",
        carried: entry,
      },
    });

    expect(standing).toEqual({
      outcome: "failed",
      error: [{ kind: "carried-changed-since-base" }],
    });
  });

  it("holds no record that needs a party at a base whose disciplines.json is unreadable, never failing", () => {
    const importBoundaries: ClauseAddress = {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-19"),
      clause: clauseIdOf("import-boundaries"),
    };
    const outsideImport: Symptom = {
      ...LOOP_KEYWORD,
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const entry = {
      kind: "authorised-location",
      clause: "CD-19#import-boundaries",
      file: "src/ids.ts",
      reason: "wraps uuid",
    } as const;
    const source = baseStandingRecordsSource({
      source: {
        read: vi.fn<RecordsSource["read"]>(),
        readAt: vi.fn<RecordsSource["readAt"]>().mockReturnValue({ outcome: "ok", value: [] }),
      },
      entries: {
        atBase: vi
          .fn<VersionOneEntries["atBase"]>()
          .mockReturnValue({ outcome: "ok", value: [{ entry, carried: entry }] }),
        selectionAtBase: vi
          .fn<VersionOneEntries["selectionAtBase"]>()
          .mockReturnValue({ outcome: "ok", value: { presence: "unreadable-in-base" } }),
      },
      catalogue: {
        ...SETTINGS_CATALOGUE,
        symptoms: [outsideImport],
        clauses: [
          { clause: importBoundaries, sight: { kind: "one-symptom", symptom: outsideImport } },
        ],
        checks: [
          {
            name: "import-or-require",
            symptom: outsideImport,
            page: "outside-import-past-a-boundary/import-or-require.md",
            clause: importBoundaries,
            engines: [WALKER],
            forms: [],
            findingSpecifics: ["outside-party"],
          },
        ],
      },
    });

    const read = source.readAt({ revision: "origin/main" });

    expect(read).toEqual(NO_DOCUMENTS);
  });
});

describe("baseStandingRecordsSource over a catalogue that holds a team's clauses beside Hone's", () => {
  const acme = { name: ruleSetNameOf("acme") };

  const directConsole: Symptom = {
    ...LOOP_KEYWORD,
    ruleSet: acme,
    name: "direct-console",
    title: "Direct console",
  };

  const consoleClause: ClauseAddress = {
    ruleSet: acme,
    discipline: disciplineIdOf("ACME-1"),
    clause: clauseIdOf("console-calls"),
  };

  const consoleCalls: Check = {
    name: "console-calls",
    symptom: directConsole,
    page: "direct-console/console-calls.md",
    clause: consoleClause,
    engines: [WALKER],
    forms: [],
    findingSpecifics: [],
  };

  const draftCalls: Check = {
    ...consoleCalls,
    name: "draft-calls",
    page: "direct-console/draft-calls.md",
    clause: { ...consoleClause, clause: clauseIdOf("draft-calls") },
  };

  const named: SymptomCatalogue = {
    ...SETTINGS_CATALOGUE,
    symptoms: [...SETTINGS_CATALOGUE.symptoms, directConsole],
    checks: [...SETTINGS_CATALOGUE.checks, consoleCalls, draftCalls],
  };

  const location = {
    kind: "authorised-location",
    clause: "acme/ACME-1#console-calls",
    file: "src/a.ts",
    reason: "the one place",
  } as const;

  const carveOut = {
    kind: "file-carve-out",
    clause: "acme/ACME-1#console-calls",
    file: "src/b.ts",
    reason: "legacy",
  } as const;

  const locationFile = repoPathOf("hone-records/acme/authorised-locations/direct-console.json");

  it("holds a team's location and carve-out at the team's check, in the team's records folder, and Hone's location where it was", () => {
    const source = baseStandingRecordsSource({
      source: sourceReadingBase({ base: NO_DOCUMENTS }),
      entries: entriesAtBase({
        read: {
          outcome: "ok",
          value: [
            { entry: location, carried: location },
            { entry: carveOut, carried: carveOut },
            { entry: LOOPS_ENTRY, carried: LOOPS_ENTRY },
          ],
        },
      }),
      catalogue: named,
    });

    const read = source.readAt({ revision: "origin/main" });

    expect(read).toEqual({
      outcome: "ok",
      value: [
        {
          file: locationFile,
          document: {
            version: 2,
            records: [
              { answers: "direct-console#console-calls", file: "src/a.ts", carried: location },
            ],
          },
        },
        LOOPS_DOCUMENT,
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

  it("holds nothing for a team's entries when its checks name no clause, as when its names file is missing", () => {
    const unnamed: Check = {
      name: "console-calls",
      symptom: directConsole,
      page: "direct-console/console-calls.md",
      engines: [WALKER],
      forms: [],
      findingSpecifics: [],
    };
    const source = baseStandingRecordsSource({
      source: sourceReadingBase({ base: NO_DOCUMENTS }),
      entries: entriesAtBase({
        read: {
          outcome: "ok",
          value: [
            { entry: location, carried: location },
            { entry: carveOut, carried: carveOut },
          ],
        },
      }),
      catalogue: { ...SETTINGS_CATALOGUE, symptoms: [directConsole], checks: [unnamed] },
    });

    const read = source.readAt({ revision: "origin/main" });

    expect(read).toEqual(NO_DOCUMENTS);
  });

  it.each<{
    readonly name: string;
    readonly file: RepoPath;
    readonly entry: ReadonlyJsonValue;
  }>([
    {
      name: "repointed alone to another check of the set",
      file: locationFile,
      entry: { answers: "direct-console#draft-calls", file: "src/a.ts", carried: location },
    },
    {
      name: "given an outside party the base did not confine",
      file: locationFile,
      entry: {
        answers: "direct-console#console-calls",
        file: "src/a.ts",
        outsideParty: "zod",
        carried: location,
      },
    },
    {
      name: "that is a carve-out filed among the authorised locations",
      file: locationFile,
      entry: { answers: "direct-console#console-calls", file: "src/b.ts", carried: carveOut },
    },
    {
      name: "filed in Hone's own records folder",
      file: repoPathOf("hone-records/authorised-locations/direct-console.json"),
      entry: { answers: "direct-console#console-calls", file: "src/a.ts", carried: location },
    },
  ])("refuses a team's carried record $name", ({ file, entry }) => {
    const source = baseStandingRecordsSource({
      source: sourceReadingBase({ base: NO_DOCUMENTS }),
      entries: entriesAtBase({
        read: {
          outcome: "ok",
          value: [
            { entry: location, carried: location },
            { entry: carveOut, carried: carveOut },
          ],
        },
      }),
      catalogue: named,
    });
    const base = source.readAt({ revision: "origin/main" });
    assert(base.outcome === "ok");

    const standing = carriedStandingOf({
      base: { measured: "yes", documents: base.value },
      file,
      entry,
    });

    expect(standing).toEqual({
      outcome: "failed",
      error: [{ kind: "carried-changed-since-base" }],
    });
  });
});

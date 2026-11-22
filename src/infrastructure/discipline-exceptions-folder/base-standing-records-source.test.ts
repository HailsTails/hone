import { describe, expect, it, vi } from "vitest";

import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import type { RecordsSource } from "../../application/ports/records/records-source.ts";
import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type { RecordsDocument } from "../../domain/records/hone-records/hone-record.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import type { RuleSetCatalogue } from "../../domain/settings/check-choices.ts";
import { carriedStandingOf } from "../hone-records-folder/reading/carried-standing.ts";
import {
  baseStandingRecordsSource,
  versionOneAwareRecordsSourceOf,
} from "./base-standing-records-source.ts";
import type { VersionOneEntries } from "./version-one-entries.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT: Engine = { name: "eslint" };

const LOOP_KEYWORD: Symptom = {
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
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT],
  forms: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [WALKER, ESLINT],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "a-for-loop", symptom: LOOP_KEYWORD },
          { section: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: LAYERING_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

const CATALOGUES: readonly RuleSetCatalogue[] = [
  { ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE },
];

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
});

const readAtBaseHolding = (request: {
  readonly entries: ReturnType<VersionOneEntries["atBase"]>;
  readonly base: ReturnType<RecordsSource["readAt"]>;
}) =>
  baseStandingRecordsSource({
    source: sourceReadingBase({ base: request.base }),
    entries: entriesAtBase({ read: request.entries }),
    catalogues: CATALOGUES,
  }).readAt({ revision: "origin/main" });

const readAtBaseWith = (request: { readonly entries: ReturnType<VersionOneEntries["atBase"]> }) =>
  readAtBaseHolding({ entries: request.entries, base: NO_DOCUMENTS });

describe("baseStandingRecordsSource writing the records the base's version 1 entries would have become", () => {
  it("writes an authorised location as a record at the one check of its clause, carrying the entry word for word", () => {
    expect(readAtBaseWith({ entries: { outcome: "ok", value: [LOOPS_ENTRY] } })).toEqual({
      outcome: "ok",
      value: [LOOPS_DOCUMENT],
    });
  });

  it("writes an authorised location of a two-check clause as a record at each of its checks, in the file of each check's symptom", () => {
    expect(readAtBaseWith({ entries: { outcome: "ok", value: [TEST_BODY_ENTRY] } })).toEqual({
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
    expect(readAtBaseWith({ entries: { outcome: "ok", value: [LOOPS_ENTRY] } })).not.toEqual({
      outcome: "ok",
      value: expect.arrayContaining([expect.objectContaining({ file: REBINDING_AUTHORISED })]),
    });
  });

  it("writes the record at the entry's own file, so a record at another file finds nothing at the base to match", () => {
    expect(
      readAtBaseWith({ entries: { outcome: "ok", value: [{ ...LOOPS_ENTRY, file: "src/b.ts" }] } }),
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
        entries: { outcome: "ok", value: [LOOPS_ENTRY, { ...LOOPS_ENTRY, file: "src/b.ts" }] },
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
    };
    expect(readAtBaseWith({ entries: { outcome: "ok", value: [carveOut] } })).toEqual({
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
              kind: "clause-wide-carve-out",
              clause: "CD-15#loops",
              reason: "generated",
              whyChain: "kept",
            },
          ],
        },
      }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("writes nothing for an authorised location whose clause has no check in the catalogue", () => {
    expect(
      readAtBaseWith({
        entries: { outcome: "ok", value: [{ ...LOOPS_ENTRY, clause: "CD-99#unknown" }] },
      }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("writes nothing for an entry whose clause or file does not parse", () => {
    expect(
      readAtBaseWith({
        entries: {
          outcome: "ok",
          value: [
            { ...LOOPS_ENTRY, clause: "not a clause" },
            { ...LOOPS_ENTRY, file: "/absolute.ts" },
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
          value: [{ ...LOOPS_ENTRY, clause: "CD-99#unknown" }, LOOPS_ENTRY],
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: [LOOPS_DOCUMENT],
    });
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
        entries: { outcome: "ok", value: [LOOPS_ENTRY] },
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
        entries: { outcome: "ok", value: [LOOPS_ENTRY] },
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
        entries: { outcome: "ok", value: [LOOPS_ENTRY] },
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
        catalogues: CATALOGUES,
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
    expect(readAtBaseWith({ entries: { outcome: "ok", value: [CARVE_OUT] } })).toEqual({
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
        entries: { outcome: "ok", value: [CARVE_OUT] },
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
    const source = versionOneAwareRecordsSourceOf({
      recordsSourceOf: () => sourceReadingBase({ base: NO_DOCUMENTS }),
      exceptionRepositoryOf,
    })({
      fileText: { exists: vi.fn(), read: vi.fn() },
      directory: { list: vi.fn() },
      git: { textInBase: vi.fn() },
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

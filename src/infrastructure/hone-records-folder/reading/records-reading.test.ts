import { describe, expect, it } from "vitest";

import type {
  Check,
  Symptom,
  AuthorisedLocationKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  AuthorisedLocation,
  RecordsAtBase,
  SymptomReach,
} from "../../../domain/records/hone-records/hone-record.ts";
import { sameRecordIdentity } from "../../../domain/records/hone-records/record-identity.ts";
import type { WhyChain } from "../../../domain/records/why-chain.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { readRecords, recordsReader } from "./records-reading.ts";

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [
    {
      situation: "an outside contract forces the type",
      kind: AUTHORISED_LOCATION_KIND,
      binding: "check-and-file",
    },
  ],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: { ruleSet: "hone", name: "claimed-type" },
  page: "claimed-type/cast-expressions.md",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("cast-expressions"),
  },
  engines: [],
  forms: [],
  findingSpecifics: [],
};

const NON_NULL_CHECK: Check = {
  name: "non-null-assertions",
  symptom: { ruleSet: "hone", name: "claimed-type" },
  page: "claimed-type/non-null-assertions.md",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("non-null-assertions"),
  },
  engines: [],
  forms: [],
  findingSpecifics: [],
};

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const TEXT_PAST_ITS_READER: Symptom = {
  ruleSet: "hone",
  name: "text-past-its-reader",
  title: "Text past its reader",
  seen: "A string.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [
    { situation: "one test site", kind: AUTHORISED_LOCATION_KIND, binding: "check-and-file" },
  ],
};

const UNMEASURED: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const ADAPTER = repoPathOf("src/adapters/ids.ts");

const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does held.ts hold this symptom?",
      because: "An outside contract fixes the shape the unit must meet at this place.",
      evidence: "src/held.ts:1.",
    },
    {
      why: "Why does an outside contract fix the shape?",
      because: "The vendor publishes the payload format and validates requests against it.",
      evidence: "https://example.com/spec.",
    },
    {
      why: "Why does the vendor validate requests against the payload format?",
      because: "Its gateway rejects any field outside the published schema before routing.",
      evidence: "https://example.com/gateway.",
    },
    {
      why: "Why does the gateway reject fields outside the published schema?",
      because: "Strict schemas let the vendor version its interface without silent drift.",
      evidence: "https://example.com/versioning.",
    },
    {
      why: "Why do strict schemas let the vendor version without drift?",
      because: "Clients that send unknown fields fail fast, so every client upgrades on purpose.",
      evidence: "https://example.com/upgrades.",
    },
  ],
  rootCause: "Clients that send unknown fields fail fast, so every client upgrades on purpose.",
  rootEvidence: "On 2026-11-20, https://example.com/upgrades still says unknown fields fail fast.",
  readback:
    "Clients that send unknown fields fail fast, therefore the vendor keeps strict schemas, therefore held.ts holds this symptom.",
  owner: "owner decision on example/app#1",
};

describe("readRecords", () => {
  it("places each record by its file and its index there, in the order the documents come", () => {
    const textDebtFile = repoPathOf("hone-records/debt/text-past-its-reader.json");
    expect(
      readRecords({
        documents: [
          {
            file: textDebtFile,
            document: {
              version: 2,
              records: [{ answers: "text-past-its-reader", file: "src/adapters/system-clock.ts" }],
            },
          },
          {
            file: DEBT_FILE,
            document: {
              version: 2,
              records: [
                { answers: "claimed-type", file: "src/a.ts" },
                { answers: "claimed-type", file: "src/b.ts" },
              ],
            },
          },
        ],
        symptoms: [CLAIMED_TYPE, TEXT_PAST_ITS_READER],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: textDebtFile, index: 0 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "text-past-its-reader" },
              reach: WHOLE_SYMPTOM,
              file: "src/adapters/system-clock.ts",
              holding: { held: "stated" },
            },
          },
          {
            place: { file: DEBT_FILE, index: 0 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
          {
            place: { file: DEBT_FILE, index: 1 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: "src/b.ts",
              holding: { held: "stated" },
            },
          },
        ],
        refused: [],
        notes: [],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("places a refused record by its file and index, beside the records it does not stop", () => {
    expect(
      readRecords({
        documents: [
          {
            file: DEBT_FILE,
            document: {
              version: 2,
              records: [{ answers: "claimed-type" }, { answers: "claimed-type", file: "src/b.ts" }],
            },
          },
        ],
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: DEBT_FILE, index: 1 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: "src/b.ts",
              holding: { held: "stated" },
            },
          },
        ],
        refused: [
          {
            place: { file: DEBT_FILE, index: 0 },
            refusals: [
              { kind: "form-refused", issues: [expect.objectContaining({ path: ["file"] })] },
            ],
          },
        ],
        notes: [],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("refuses a record whose own text names no file it could be filed in, and still reads the records beside it", () => {
    expect(
      readRecords({
        documents: [
          {
            file: DEBT_FILE,
            document: {
              version: 2,
              records: [
                { answers: "/x", file: "src/a.ts" },
                { answers: "claimed-type", file: "src/b.ts" },
              ],
            },
          },
        ],
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: DEBT_FILE, index: 1 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: "src/b.ts",
              holding: { held: "stated" },
            },
          },
        ],
        refused: [
          {
            place: { file: DEBT_FILE, index: 0 },
            refusals: [
              { kind: "form-refused", issues: [expect.objectContaining({ path: ["answers"] })] },
            ],
          },
        ],
        notes: [],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("keeps an authorised location whose case is not the catalogue's among the records, and notes it by its place for the report", () => {
    expect(
      readRecords({
        documents: [
          {
            file: AUTHORISED_FILE,
            document: {
              version: 2,
              records: [
                {
                  answers: "claimed-type#cast-expressions",
                  file: "src/held.ts",
                  case: "needs-it-here",
                  owes: "declared-not-asserted",
                  whyChain: WHY_CHAIN,
                },
              ],
            },
          },
        ],
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: AUTHORISED_FILE, index: 0 },
            record: {
              kind: "authorised-location",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: {
                reaches: "one-check",
                check: {
                  name: "cast-expressions",
                  symptom: { ruleSet: "hone", name: "claimed-type" },
                },
              },
              file: "src/held.ts",
              holding: {
                binding: { binds: "check-and-file" },
                held: "stated",
                owing: {
                  matches: "not-the-catalogue",
                  note: {
                    kind: "unknown-case",
                    case: "needs-it-here",
                    owes: "declared-not-asserted",
                  },
                },
                whyChain: WHY_CHAIN,
              },
            },
          },
        ],
        refused: [],
        notes: [
          {
            place: { file: AUTHORISED_FILE, index: 0 },
            note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" },
          },
        ],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("says the base revision was measured when it was, with each record the base held and none it refuses", () => {
    expect(
      readRecords({
        documents: [],
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: {
          measured: "yes",
          documents: [
            {
              file: DEBT_FILE,
              document: {
                version: 2,
                records: [
                  { answers: "claimed-type", file: "src/basket.ts" },
                  { answers: "unknown-symptom", file: "src/clock.ts" },
                ],
              },
            },
            { file: repoPathOf("hone-records/debt/broken.json"), document: { records: [] } },
          ],
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [],
        refused: [],
        notes: [],
        base: {
          measured: "yes",
          held: [
            {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: "src/basket.ts",
              holding: { held: "stated" },
            },
          ],
        },
      },
    });
  });

  it("says why the base revision was not measured, as the value it was handed", () => {
    expect(
      readRecords({
        documents: [],
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: {
          measured: "no",
          base: { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad revision" },
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [],
        refused: [],
        notes: [],
        base: {
          measured: "no",
          base: { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad revision" },
        },
      },
    });
  });

  it("refuses a second record of one kind on one symptom and site, naming the first", () => {
    const record = { answers: "claimed-type", file: "src/a.ts" };
    expect(
      readRecords({
        documents: [{ file: DEBT_FILE, document: { version: 2, records: [record, record] } }],
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: DEBT_FILE, index: 0 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
        ],
        refused: [
          {
            place: { file: DEBT_FILE, index: 1 },
            refusals: [{ kind: "duplicate", of: { file: DEBT_FILE, index: 0 } }],
          },
        ],
        notes: [],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("reads two records of one kind on two checks of one symptom at one site as two records", () => {
    expect(
      readRecords({
        documents: [
          {
            file: DEBT_FILE,
            document: {
              version: 2,
              records: [
                { answers: "claimed-type#cast-expressions", file: "src/a.ts" },
                { answers: "claimed-type#non-null-assertions", file: "src/a.ts" },
              ],
            },
          },
        ],
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK, NON_NULL_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: DEBT_FILE, index: 0 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: {
                reaches: "one-check",
                check: {
                  name: "cast-expressions",
                  symptom: { ruleSet: "hone", name: "claimed-type" },
                },
              },
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
          {
            place: { file: DEBT_FILE, index: 1 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: {
                reaches: "one-check",
                check: {
                  name: "non-null-assertions",
                  symptom: { ruleSet: "hone", name: "claimed-type" },
                },
              },
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
        ],
        refused: [],
        notes: [],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("reads a record on a whole symptom and one on a check of it, at one site, as two records", () => {
    expect(
      readRecords({
        documents: [
          {
            file: DEBT_FILE,
            document: {
              version: 2,
              records: [
                { answers: "claimed-type", file: "src/a.ts" },
                { answers: "claimed-type#cast-expressions", file: "src/a.ts" },
              ],
            },
          },
        ],
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: DEBT_FILE, index: 0 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
          {
            place: { file: DEBT_FILE, index: 1 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: {
                reaches: "one-check",
                check: {
                  name: "cast-expressions",
                  symptom: { ruleSet: "hone", name: "claimed-type" },
                },
              },
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
        ],
        refused: [],
        notes: [],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("keeps an authorised location naming a check its symptom does not have among the records, and notes the check by its place for the report", () => {
    const entry = {
      answers: "claimed-type#no-such-check",
      file: "src/held.ts",
      carried: { kind: "authorised-location" },
    };
    expect(
      readRecords({
        documents: [{ file: AUTHORISED_FILE, document: { version: 2, records: [entry] } }],
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: AUTHORISED_FILE, index: 0 },
            record: {
              kind: "authorised-location",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: { reaches: "unknown-check", check: "no-such-check" },
              file: "src/held.ts",
              holding: {
                binding: { binds: "check-and-file" },
                held: "carried",
                entry: { kind: "authorised-location" },
                lacks: ["case", "owes", "whyChain"],
                standing: "unjudged",
              },
            },
          },
        ],
        refused: [],
        notes: [
          {
            place: { file: AUTHORISED_FILE, index: 0 },
            note: {
              kind: "unknown-check",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              check: "no-such-check",
            },
          },
        ],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("notes both the check and the case of an authorised location that names neither as the catalogue does", () => {
    expect(
      readRecords({
        documents: [
          {
            file: AUTHORISED_FILE,
            document: {
              version: 2,
              records: [
                {
                  answers: "claimed-type#no-such-check",
                  file: "src/held.ts",
                  case: "needs-it-here",
                  owes: "declared-not-asserted",
                  whyChain: WHY_CHAIN,
                },
              ],
            },
          },
        ],
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        notes: [
          {
            place: { file: AUTHORISED_FILE, index: 0 },
            note: {
              kind: "unknown-check",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              check: "no-such-check",
            },
          },
          {
            place: { file: AUTHORISED_FILE, index: 0 },
            note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" },
          },
        ],
      },
    });
  });

  it("refuses a second record of one kind on one check and site, naming the first", () => {
    const record = { answers: "claimed-type#cast-expressions", file: "src/a.ts" };
    expect(
      readRecords({
        documents: [{ file: DEBT_FILE, document: { version: 2, records: [record, record] } }],
        symptoms: [CLAIMED_TYPE],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        refused: [
          {
            place: { file: DEBT_FILE, index: 1 },
            refusals: [{ kind: "duplicate", of: { file: DEBT_FILE, index: 0 } }],
          },
        ],
      },
    });
  });

  it("holds two records the same only when each field of their identity is the same, never by joined text", () => {
    expect(
      sameRecordIdentity({
        left: {
          kind: "authorised-location",
          symptom: { ruleSet: "hone", name: "claimed-type" },
          reach: { reaches: "one-check", check: CAST_CHECK },
          file: repoPathOf("src/a b"),
          holding: {
            binding: {
              binds: "check-file-and-outside-party",
              outsideParty: { kind: "package", dependency: "c" },
            },
            held: "carried",
            entry: {},
            lacks: [],
            standing: "unjudged",
          },
        },
        right: {
          kind: "authorised-location",
          symptom: { ruleSet: "hone", name: "claimed-type" },
          reach: { reaches: "one-check", check: CAST_CHECK },
          file: repoPathOf("src/a"),
          holding: {
            binding: {
              binds: "check-file-and-outside-party",
              outsideParty: { kind: "package", dependency: "b c" },
            },
            held: "carried",
            entry: {},
            lacks: [],
            standing: "unjudged",
          },
        },
      }),
    ).toBe("different");
  });

  it("holds a package and a module different even where their text could meet", () => {
    expect(
      sameRecordIdentity({
        left: {
          kind: "authorised-location",
          symptom: { ruleSet: "hone", name: "claimed-type" },
          reach: { reaches: "one-check", check: CAST_CHECK },
          file: ADAPTER,
          holding: {
            binding: {
              binds: "check-file-and-outside-party",
              outsideParty: { kind: "package", dependency: "node:fs" },
            },
            held: "carried",
            entry: {},
            lacks: [],
            standing: "unjudged",
          },
        },
        right: {
          kind: "authorised-location",
          symptom: { ruleSet: "hone", name: "claimed-type" },
          reach: { reaches: "one-check", check: CAST_CHECK },
          file: ADAPTER,
          holding: {
            binding: {
              binds: "check-file-and-outside-party",
              outsideParty: { kind: "scheme-module", specifier: "node:fs" },
            },
            held: "carried",
            entry: {},
            lacks: [],
            standing: "unjudged",
          },
        },
      }),
    ).toBe("different");
  });

  it("reads two authorised locations that differ only by their outside party as two records", () => {
    const outsideImportPastABoundary: Symptom = {
      ruleSet: "hone",
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
    const importCheck: Check = {
      name: "import-or-require",
      symptom: { ruleSet: "hone", name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      engines: [],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    const importsFile = repoPathOf(
      "hone-records/authorised-locations/outside-import-past-a-boundary.json",
    );
    const uuidLocation: AuthorisedLocation = {
      kind: "authorised-location",
      symptom: { ruleSet: "hone", name: "outside-import-past-a-boundary" },
      reach: {
        reaches: "one-check",
        check: {
          name: "import-or-require",
          symptom: { ruleSet: "hone", name: "outside-import-past-a-boundary" },
        },
      },
      file: repoPathOf("src/adapters/ids.ts"),
      holding: {
        held: "carried",
        binding: {
          binds: "check-file-and-outside-party",
          outsideParty: { kind: "package", dependency: "uuid" },
        },
        entry: { kind: "authorised-location" },
        lacks: ["case", "owes", "whyChain"],
        standing: "unjudged",
      },
    };
    const record = {
      answers: "outside-import-past-a-boundary#import-or-require",
      file: "src/adapters/ids.ts",
      carried: { kind: "authorised-location" },
    };
    expect(
      readRecords({
        documents: [
          {
            file: importsFile,
            document: {
              version: 2,
              records: [
                { ...record, outsideParty: "uuid" },
                { ...record, outsideParty: "node:" },
              ],
            },
          },
        ],
        symptoms: [outsideImportPastABoundary],
        checks: [importCheck],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        base: UNMEASURED,
        notes: [],
        records: [
          { place: { file: importsFile, index: 0 }, record: uuidLocation },
          {
            place: { file: importsFile, index: 1 },
            record: {
              ...uuidLocation,
              holding: {
                ...uuidLocation.holding,
                binding: {
                  binds: "check-file-and-outside-party",
                  outsideParty: { kind: "scheme", scheme: "node:" },
                },
              },
            },
          },
        ],
        refused: [],
      },
    });
  });

  it("refuses a second authorised location for one check, file and outside party, naming the first", () => {
    const outsideImportPastABoundary: Symptom = {
      ruleSet: "hone",
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
    const importCheck: Check = {
      name: "import-or-require",
      symptom: { ruleSet: "hone", name: "outside-import-past-a-boundary" },
      page: "outside-import-past-a-boundary/import-or-require.md",
      engines: [],
      forms: [],
      findingSpecifics: ["outside-party"],
    };
    const importsFile = repoPathOf(
      "hone-records/authorised-locations/outside-import-past-a-boundary.json",
    );
    const uuidLocation: AuthorisedLocation = {
      kind: "authorised-location",
      symptom: { ruleSet: "hone", name: "outside-import-past-a-boundary" },
      reach: {
        reaches: "one-check",
        check: {
          name: "import-or-require",
          symptom: { ruleSet: "hone", name: "outside-import-past-a-boundary" },
        },
      },
      file: repoPathOf("src/adapters/ids.ts"),
      holding: {
        held: "carried",
        binding: {
          binds: "check-file-and-outside-party",
          outsideParty: { kind: "package", dependency: "uuid" },
        },
        entry: { kind: "authorised-location" },
        lacks: ["case", "owes", "whyChain"],
        standing: "unjudged",
      },
    };
    const record = {
      answers: "outside-import-past-a-boundary#import-or-require",
      file: "src/adapters/ids.ts",
      outsideParty: "uuid",
      carried: { kind: "authorised-location" },
    };

    const reading = readRecords({
      documents: [{ file: importsFile, document: { version: 2, records: [record, record] } }],
      symptoms: [outsideImportPastABoundary],
      checks: [importCheck],
      recipes: [],
      cases: [],
      namedBans: [],
      base: UNMEASURED,
    });

    expect(reading).toEqual({
      outcome: "ok",
      value: {
        base: UNMEASURED,
        notes: [],
        records: [{ place: { file: importsFile, index: 0 }, record: uuidLocation }],
        refused: [
          {
            place: { file: importsFile, index: 1 },
            refusals: [{ kind: "duplicate", of: { file: importsFile, index: 0 } }],
          },
        ],
      },
    });
  });

  it.each([
    {
      symptom: { ruleSet: "hone", name: "claimed-type" },
      file: repoPathOf("hone-records/debt/claimed-type.json"),
    },
    {
      symptom: { ruleSet: "hone", name: "text-past-its-reader" },
      file: repoPathOf("hone-records/debt/text-past-its-reader.json"),
    },
  ])("accepts debt on $symptom.name: debt is debt, not blockers", ({ symptom, file }) => {
    expect(
      readRecords({
        documents: [
          {
            file,
            document: { version: 2, records: [{ answers: symptom.name, file: "src/held.ts" }] },
          },
        ],
        symptoms: [CLAIMED_TYPE, TEXT_PAST_ITS_READER],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        records: [{ record: { kind: "debt", symptom: { name: symptom.name } } }],
        refused: [],
      },
    });
  });

  it.each([
    {
      symptom: CLAIMED_TYPE,
      answers: "claimed-type#cast-expressions",
      file: repoPathOf("hone-records/authorised-locations/claimed-type.json"),
    },
    {
      symptom: TEXT_PAST_ITS_READER,
      answers: "text-past-its-reader#json-parse",
      file: repoPathOf("hone-records/authorised-locations/text-past-its-reader.json"),
    },
  ])(
    "never refuses an authorised location for being on $symptom.name",
    ({ symptom, answers, file }) => {
      const reading = readRecords({
        documents: [
          {
            file,
            document: {
              version: 2,
              records: [
                {
                  answers,
                  file: "src/held.ts",
                  case: "gives-a-value-its-type",
                  owes: "declared-not-asserted",
                  whyChain: WHY_CHAIN,
                },
              ],
            },
          },
        ],
        symptoms: [CLAIMED_TYPE, TEXT_PAST_ITS_READER],
        checks: [CAST_CHECK],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      });

      expect(reading).toMatchObject({
        outcome: "ok",
        value: {
          records: [{ record: { kind: "authorised-location", symptom: { name: symptom.name } } }],
          refused: [],
        },
      });
    },
  );

  it("refuses a document that is not version 2, with the form's issues as values", () => {
    expect(
      readRecords({
        documents: [{ file: DEBT_FILE, document: { version: 1, records: [] } }],
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "failed",
      error: [
        {
          kind: "document-refused",
          file: DEBT_FILE,
          issues: [{ path: ["version"], message: expect.any(String) }],
        },
      ],
    });
  });

  it("refuses a file that is not a records file", () => {
    const file = repoPathOf("hone-records/carve-outs/claimed-type.json");
    expect(
      readRecords({
        documents: [{ file, document: { version: 2, records: [] } }],
        symptoms: [],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "not-a-records-file", file }],
    });
  });

  it("reads a team's debt in its rule set's folder as owed on the team's symptom", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamClaimedType: Symptom = { ...CLAIMED_TYPE, ruleSet: acme };
    const file = repoPathOf("hone-records/acme/debt/claimed-type.json");
    expect(
      readRecords({
        documents: [
          {
            file,
            document: { version: 2, records: [{ answers: "claimed-type", file: ADAPTER }] },
          },
        ],
        symptoms: [CLAIMED_TYPE, teamClaimedType],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file, index: 0 },
            record: {
              kind: "debt",
              symptom: { ruleSet: acme, name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: ADAPTER,
              holding: { held: "stated" },
            },
          },
        ],
        refused: [],
        notes: [],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("refuses a records file in the folder of a rule set the catalogue holds no symptom of, naming the rule set", () => {
    const file = repoPathOf("hone-records/acme/debt/claimed-type.json");
    expect(
      readRecords({
        documents: [{ file, document: { version: 2, records: [] } }],
        symptoms: [CLAIMED_TYPE],
        checks: [],
        recipes: [],
        cases: [],
        namedBans: [],
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "unknown-rule-set", file, ruleSet: "acme" }],
    });
  });
});

describe("recordsReader", () => {
  it("reads records against the catalogue it is handed", () => {
    const file = repoPathOf("hone-records/debt/claimed-type.json");

    const reading = recordsReader.recordsReadingOf({
      documents: [
        {
          file,
          document: { version: 2, records: [{ answers: "claimed-type", file: "src/a.ts" }] },
        },
      ],
      catalogue: {
        principles: [],
        rules: [],
        cases: [],
        recipes: [],
        recordKinds: [AUTHORISED_LOCATION_KIND],
        engines: [],
        symptoms: [CLAIMED_TYPE],
        clauses: [],
        checks: [],
        namedBans: [],
      },
      base: UNMEASURED,
    });

    expect(reading).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file, index: 0 },
            record: {
              kind: "debt",
              symptom: { ruleSet: "hone", name: "claimed-type" },
              reach: WHOLE_SYMPTOM,
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
        ],
        refused: [],
        notes: [],
        base: UNMEASURED,
      },
    });
  });
});

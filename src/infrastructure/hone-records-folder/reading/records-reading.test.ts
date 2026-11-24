import { describe, expect, it } from "vitest";

import type {
  Check,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  RecordsAtBase,
  SymptomReach,
} from "../../../domain/records/hone-records/hone-record.ts";
import { sameRecordIdentity } from "../../../domain/records/hone-records/record-identity.ts";
import { carriedListingOf } from "../../../domain/records/hone-records/record-listings.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { recordsReadingOf } from "./records-reading.ts";

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("cast-expressions"),
  },
  engines: [],
  forms: [],
};

const NON_NULL_CHECK: Check = {
  name: "non-null-assertions",
  symptom: CLAIMED_TYPE,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("non-null-assertions"),
  },
  engines: [],
  forms: [],
};

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [],
  symptoms: [CLAIMED_TYPE],
  clauses: [],
  checks: [CAST_CHECK, NON_NULL_CHECK],
  namedBans: [],
};

const TEXT_PAST_ITS_READER: Symptom = {
  ruleSet: "hone",
  name: "text-past-its-reader",
  title: "Text past its reader",
  seen: "A string.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CATALOGUE_OF_TWO_SYMPTOMS: SymptomCatalogue = {
  ...CATALOGUE,
  symptoms: [CLAIMED_TYPE, TEXT_PAST_ITS_READER],
};

const UNMEASURED: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const BOUNDARIES_FILE = repoPathOf("hone-records/boundary-records.json");

const ADAPTER = repoPathOf("src/adapters/ids.ts");

const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const WHY_CHAIN = {
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

describe("recordsReadingOf", () => {
  it("places each record by its file and its index there, in the order the documents come", () => {
    expect(
      recordsReadingOf({
        documents: [
          {
            file: BOUNDARIES_FILE,
            document: {
              version: 2,
              records: [
                {
                  module: "src/adapters/system-clock.ts",
                  outsideParty: "runtime:clock",
                  ports: ["Clock"],
                },
              ],
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
        catalogue: CATALOGUE,
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: BOUNDARIES_FILE, index: 0 },
            record: {
              kind: "boundary-record",
              module: "src/adapters/system-clock.ts",
              outsideParty: { kind: "runtime", facility: "clock" },
              holding: { held: "stated", ports: ["Clock"] },
            },
          },
          {
            place: { file: DEBT_FILE, index: 0 },
            record: {
              kind: "debt",
              symptom: CLAIMED_TYPE,
              reach: WHOLE_SYMPTOM,
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
          {
            place: { file: DEBT_FILE, index: 1 },
            record: {
              kind: "debt",
              symptom: CLAIMED_TYPE,
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
      recordsReadingOf({
        documents: [
          {
            file: DEBT_FILE,
            document: {
              version: 2,
              records: [{ answers: "claimed-type" }, { answers: "claimed-type", file: "src/b.ts" }],
            },
          },
        ],
        catalogue: CATALOGUE,
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
              symptom: CLAIMED_TYPE,
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
      recordsReadingOf({
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
        catalogue: CATALOGUE,
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
              symptom: CLAIMED_TYPE,
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
      recordsReadingOf({
        documents: [
          {
            file: AUTHORISED_FILE,
            document: {
              version: 2,
              records: [
                {
                  answers: "claimed-type",
                  file: "src/held.ts",
                  case: "needs-it-here",
                  owes: "declared-not-asserted",
                  whyChain: WHY_CHAIN,
                },
              ],
            },
          },
        ],
        catalogue: CATALOGUE,
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
              symptom: CLAIMED_TYPE,
              reach: WHOLE_SYMPTOM,
              file: "src/held.ts",
              holding: {
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

  it("says the base revision was measured when it was, with the file each base record held at its place", () => {
    expect(
      recordsReadingOf({
        documents: [],
        catalogue: CATALOGUE,
        base: {
          measured: "yes",
          documents: [
            {
              file: repoPathOf("hone-records/debt/claimed-type.json"),
              document: {
                version: 2,
                records: [
                  { answers: "claimed-type", file: "src/basket.ts" },
                  { module: "src/clock.ts" },
                  { answers: "claimed-type", file: "src/total.ts" },
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
              place: { file: "hone-records/debt/claimed-type.json", index: 0 },
              file: "src/basket.ts",
            },
            {
              place: { file: "hone-records/debt/claimed-type.json", index: 2 },
              file: "src/total.ts",
            },
          ],
        },
      },
    });
  });

  it("says why the base revision was not measured, as the value it was handed", () => {
    expect(
      recordsReadingOf({
        documents: [],
        catalogue: CATALOGUE,
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
      recordsReadingOf({
        documents: [{ file: DEBT_FILE, document: { version: 2, records: [record, record] } }],
        catalogue: CATALOGUE,
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
              symptom: CLAIMED_TYPE,
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
      recordsReadingOf({
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
        catalogue: CATALOGUE,
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
              symptom: CLAIMED_TYPE,
              reach: { reaches: "one-check", check: CAST_CHECK },
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
          {
            place: { file: DEBT_FILE, index: 1 },
            record: {
              kind: "debt",
              symptom: CLAIMED_TYPE,
              reach: { reaches: "one-check", check: NON_NULL_CHECK },
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
      recordsReadingOf({
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
        catalogue: CATALOGUE,
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
              symptom: CLAIMED_TYPE,
              reach: WHOLE_SYMPTOM,
              file: "src/a.ts",
              holding: { held: "stated" },
            },
          },
          {
            place: { file: DEBT_FILE, index: 1 },
            record: {
              kind: "debt",
              symptom: CLAIMED_TYPE,
              reach: { reaches: "one-check", check: CAST_CHECK },
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
      recordsReadingOf({
        documents: [{ file: AUTHORISED_FILE, document: { version: 2, records: [entry] } }],
        catalogue: CATALOGUE,
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
              symptom: CLAIMED_TYPE,
              reach: { reaches: "unknown-check", check: "no-such-check" },
              file: "src/held.ts",
              holding: {
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
            note: { kind: "unknown-check", symptom: CLAIMED_TYPE, check: "no-such-check" },
          },
        ],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("notes both the check and the case of an authorised location that names neither as the catalogue does", () => {
    expect(
      recordsReadingOf({
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
        catalogue: CATALOGUE,
        base: UNMEASURED,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        notes: [
          {
            place: { file: AUTHORISED_FILE, index: 0 },
            note: { kind: "unknown-check", symptom: CLAIMED_TYPE, check: "no-such-check" },
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
      recordsReadingOf({
        documents: [{ file: DEBT_FILE, document: { version: 2, records: [record, record] } }],
        catalogue: CATALOGUE,
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
          kind: "boundary-record",
          module: repoPathOf("src/a b"),
          outsideParty: { kind: "package", specifier: "c", dependency: "c" },
          holding: { held: "stated", ports: ["P"] },
        },
        right: {
          kind: "boundary-record",
          module: repoPathOf("src/a"),
          outsideParty: { kind: "package", specifier: "b c", dependency: "b c" },
          holding: { held: "stated", ports: ["P"] },
        },
      }),
    ).toBe("different");
  });

  it("holds a package and a runtime facility different even where their text could meet", () => {
    expect(
      sameRecordIdentity({
        left: {
          kind: "boundary-record",
          module: ADAPTER,
          outsideParty: { kind: "runtime", facility: "clock" },
          holding: { held: "stated", ports: ["Clock"] },
        },
        right: {
          kind: "boundary-record",
          module: ADAPTER,
          outsideParty: { kind: "scheme-module", specifier: "runtime:clock" },
          holding: { held: "stated", ports: ["Clock"] },
        },
      }),
    ).toBe("different");
  });

  it("refuses a second boundary record for one module and outside party", () => {
    const record = { module: "src/adapters/files", outsideParty: "node:fs", ports: ["FileReader"] };
    expect(
      recordsReadingOf({
        documents: [
          {
            file: BOUNDARIES_FILE,
            document: { version: 2, records: [record, { ...record, ports: ["FileWriter"] }] },
          },
        ],
        catalogue: CATALOGUE,
        base: UNMEASURED,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        refused: [
          {
            place: { file: BOUNDARIES_FILE, index: 1 },
            refusals: [{ kind: "duplicate", of: { file: BOUNDARIES_FILE, index: 0 } }],
          },
        ],
      },
    });
  });

  it.each([
    { symptom: CLAIMED_TYPE, file: repoPathOf("hone-records/debt/claimed-type.json") },
    {
      symptom: TEXT_PAST_ITS_READER,
      file: repoPathOf("hone-records/debt/text-past-its-reader.json"),
    },
  ])("accepts debt on $symptom.name: debt is debt, not blockers", ({ symptom, file }) => {
    expect(
      recordsReadingOf({
        documents: [
          {
            file,
            document: { version: 2, records: [{ answers: symptom.name, file: "src/held.ts" }] },
          },
        ],
        catalogue: CATALOGUE_OF_TWO_SYMPTOMS,
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
      file: repoPathOf("hone-records/authorised-locations/claimed-type.json"),
    },
    {
      symptom: TEXT_PAST_ITS_READER,
      file: repoPathOf("hone-records/authorised-locations/text-past-its-reader.json"),
    },
  ])("never refuses an authorised location for being on $symptom.name", ({ symptom, file }) => {
    expect(
      recordsReadingOf({
        documents: [
          {
            file,
            document: {
              version: 2,
              records: [
                {
                  answers: symptom.name,
                  file: "src/held.ts",
                  case: "gives-a-value-its-type",
                  owes: "declared-not-asserted",
                  whyChain: WHY_CHAIN,
                },
              ],
            },
          },
        ],
        catalogue: CATALOGUE_OF_TWO_SYMPTOMS,
        base: UNMEASURED,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        records: [{ record: { kind: "authorised-location", symptom: { name: symptom.name } } }],
        refused: [],
      },
    });
  });

  it("refuses a document that is not version 2, with the form's issues as values", () => {
    expect(
      recordsReadingOf({
        documents: [{ file: DEBT_FILE, document: { version: 1, records: [] } }],
        catalogue: CATALOGUE,
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "failed",
      error: [
        {
          kind: "document-refused",
          file: DEBT_FILE,
          issues: [expect.objectContaining({ code: "invalid_value", path: ["version"] })],
        },
      ],
    });
  });

  it("lists each carried record with what it lacks and its standing, and no stated record", () => {
    expect(
      carriedListingOf({
        records: [
          {
            place: { file: BOUNDARIES_FILE, index: 0 },
            record: {
              kind: "boundary-record",
              module: ADAPTER,
              outsideParty: { kind: "runtime", facility: "clock" },
              holding: { held: "stated", ports: ["Clock"] },
            },
          },
          {
            place: { file: BOUNDARIES_FILE, index: 1 },
            record: {
              kind: "boundary-record",
              module: ADAPTER,
              outsideParty: { kind: "package", specifier: "uuid", dependency: "uuid" },
              holding: {
                held: "carried",
                entry: { kind: "authorised-location" },
                lacks: ["ports"],
                standing: "established",
              },
            },
          },
          {
            place: { file: DEBT_FILE, index: 0 },
            record: {
              kind: "debt",
              symptom: CLAIMED_TYPE,
              reach: WHOLE_SYMPTOM,
              file: ADAPTER,
              holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" },
            },
          },
        ],
      }),
    ).toEqual([
      { place: { file: BOUNDARIES_FILE, index: 1 }, lacks: ["ports"], standing: "established" },
      { place: { file: DEBT_FILE, index: 0 }, lacks: [], standing: "unjudged" },
    ]);
  });

  it("refuses a file that is not a records file", () => {
    const file = repoPathOf("hone-records/carve-outs/claimed-type.json");
    expect(
      recordsReadingOf({
        documents: [{ file, document: { version: 2, records: [] } }],
        catalogue: CATALOGUE,
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
      recordsReadingOf({
        documents: [
          {
            file,
            document: { version: 2, records: [{ answers: "claimed-type", file: ADAPTER }] },
          },
        ],
        catalogue: { ...CATALOGUE, symptoms: [...CATALOGUE.symptoms, teamClaimedType] },
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
              symptom: teamClaimedType,
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
      recordsReadingOf({
        documents: [{ file, document: { version: 2, records: [] } }],
        catalogue: CATALOGUE,
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "unknown-rule-set", file, ruleSet: "acme" }],
    });
  });
});

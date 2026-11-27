import { describe, expect, it, type Mock, vi } from "vitest";

import type {
  RecordKind,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type {
  PlacedRecord,
  RecordsDocument,
  RecordsReading,
} from "../../domain/records/hone-records/hone-record.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { GitPort } from "../ports/git-port.ts";
import type { RecordsReader } from "../ports/records/records-reader.ts";
import type { RecordsSource } from "../ports/records/records-source.ts";
import { readHoneRecords, readingFollowingRenames } from "./read-hone-records.ts";

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT_KIND: UnboundRecordKind = {
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

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [],
  symptoms: [CLAIMED_TYPE],
  clauses: [],
  checks: [],
  namedBans: [],
};

const FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const CARRIED = {
  answers: "claimed-type",
  file: "src/a.ts",
  carried: {
    kind: "authorised-location",
    clause: "CD-2#cast-expressions",
    file: "src/a.ts",
    reason: "Kept.",
  },
};

const DOCUMENTS: readonly RecordsDocument[] = [
  { file: FILE, document: { version: 2, records: [CARRIED] } },
];

const sourceOf = (request: {
  readonly read: RecordsSource["read"];
  readonly readAt: RecordsSource["readAt"];
}): RecordsSource => request;

const READING: RecordsReading = {
  records: [],
  refused: [],
  notes: [],
  base: { measured: "yes", held: [], placements: [] },
};

const readerGiving = (
  reading: ReturnType<RecordsReader["recordsReadingOf"]>,
): { readonly recordsReadingOf: Mock<RecordsReader["recordsReadingOf"]> } => ({
  recordsReadingOf: vi.fn<RecordsReader["recordsReadingOf"]>().mockReturnValue(reading),
});

describe("readHoneRecords", () => {
  it("judges carried records unjudged when no base revision is given, and reads nothing at a base", () => {
    const readAt = vi.fn<RecordsSource["readAt"]>();
    const recordsReader = readerGiving({ outcome: "ok", value: READING });
    const reading = readHoneRecords({
      recordsReader,
      source: sourceOf({
        read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: DOCUMENTS }),
        readAt,
      }),
      catalogue: CATALOGUE,
      baseRevision: undefined,
    });
    expect({
      reading,
      readAt: readAt.mock.calls,
      judged: recordsReader.recordsReadingOf.mock.calls,
    }).toEqual({
      reading: { outcome: "ok", value: READING },
      readAt: [],
      judged: [
        [
          {
            documents: DOCUMENTS,
            catalogue: CATALOGUE,
            base: { measured: "no", base: { state: "not-given" } },
          },
        ],
      ],
    });
  });

  it("judges carried records against the records the base revision holds", () => {
    const readAt = vi
      .fn<RecordsSource["readAt"]>()
      .mockReturnValue({ outcome: "ok", value: DOCUMENTS });
    const recordsReader = readerGiving({ outcome: "ok", value: READING });
    const reading = readHoneRecords({
      recordsReader,
      source: sourceOf({
        read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: DOCUMENTS }),
        readAt,
      }),
      catalogue: CATALOGUE,
      baseRevision: "origin/main",
    });
    expect({
      reading,
      readAt: readAt.mock.calls,
      judged: recordsReader.recordsReadingOf.mock.calls,
    }).toEqual({
      reading: { outcome: "ok", value: READING },
      readAt: [[{ revision: "origin/main" }]],
      judged: [
        [
          {
            documents: DOCUMENTS,
            catalogue: CATALOGUE,
            base: { measured: "yes", documents: DOCUMENTS },
          },
        ],
      ],
    });
  });

  it("judges carried records unjudged when git cannot read the base revision", () => {
    const recordsReader = readerGiving({ outcome: "ok", value: READING });
    const reading = readHoneRecords({
      recordsReader,
      source: sourceOf({
        read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: DOCUMENTS }),
        readAt: vi.fn<RecordsSource["readAt"]>().mockReturnValue({
          outcome: "failed",
          error: {
            kind: "git-failed",
            command: "git ls-tree",
            detail: "fatal: bad revision\nmore",
          },
        }),
      }),
      catalogue: CATALOGUE,
      baseRevision: "nowhere",
    });
    expect({ reading, judged: recordsReader.recordsReadingOf.mock.calls }).toEqual({
      reading: { outcome: "ok", value: READING },
      judged: [
        [
          {
            documents: DOCUMENTS,
            catalogue: CATALOGUE,
            base: {
              measured: "no",
              base: { state: "git-failed", revision: "nowhere", gitMessage: "fatal: bad revision" },
            },
          },
        ],
      ],
    });
  });

  it("fails with the folder's failure when the working records cannot be read", () => {
    expect(
      readHoneRecords({
        recordsReader: readerGiving({ outcome: "ok", value: READING }),
        source: sourceOf({
          read: vi.fn<RecordsSource["read"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "not-a-records-file", file: repoPathOf("hone-records/notes.md") },
          }),
          readAt: vi.fn<RecordsSource["readAt"]>(),
        }),
        catalogue: CATALOGUE,
        baseRevision: undefined,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "records-folder",
        failure: { kind: "not-a-records-file", file: "hone-records/notes.md" },
      },
    });
  });

  it("fails with the folder's failure when a base records file cannot be read", () => {
    expect(
      readHoneRecords({
        recordsReader: readerGiving({ outcome: "ok", value: READING }),
        source: sourceOf({
          read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: DOCUMENTS }),
          readAt: vi.fn<RecordsSource["readAt"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "records-file-not-json", file: FILE, detail: "Unexpected end" },
          }),
        }),
        catalogue: CATALOGUE,
        baseRevision: "origin/main",
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "records-folder",
        failure: { kind: "records-file-not-json", file: FILE, detail: "Unexpected end" },
      },
    });
  });

  it("fails with each document refused", () => {
    expect(
      readHoneRecords({
        recordsReader: readerGiving({
          outcome: "failed",
          error: [{ kind: "document-refused", file: FILE, issues: [] }],
        }),
        source: sourceOf({
          read: vi
            .fn<RecordsSource["read"]>()
            .mockReturnValue({ outcome: "ok", value: [{ file: FILE, document: [] }] }),
          readAt: vi.fn<RecordsSource["readAt"]>(),
        }),
        catalogue: CATALOGUE,
        baseRevision: undefined,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "records-documents",
        refusals: [{ kind: "document-refused", file: FILE, issues: [] }],
      },
    });
  });
});

const REPO_ROOT = absoluteRootOf("/work/shop");

const DEBT_ON_A: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "whole-symptom" },
    file: repoPathOf("src/a.ts"),
    holding: { held: "stated" },
  },
};

const READING_DEBT_ON_A: RecordsReading = {
  records: [DEBT_ON_A],
  refused: [],
  notes: [],
  base: { measured: "yes", held: [], placements: [] },
};

describe("readingFollowingRenames", () => {
  it("points each record on a file git saw renamed at the file's path now, and refuses it where it is held", () => {
    expect(
      readingFollowingRenames({
        reading: READING_DEBT_ON_A,
        renamed: {
          measured: "yes",
          renamed: new Map([
            [
              repoPathOf("src/moved/a.ts"),
              { basePath: repoPathOf("src/a.ts"), content: "unchanged" },
            ],
          ]),
        },
        moved: [
          {
            place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
            file: repoPathOf("src/moved/a.ts"),
          },
        ],
      }),
    ).toEqual({
      records: [
        {
          place: { file: "hone-records/debt/claimed-type.json", index: 0 },
          record: {
            kind: "debt",
            symptom: CLAIMED_TYPE,
            reach: { reaches: "whole-symptom" },
            file: "src/moved/a.ts",
            holding: { held: "stated" },
          },
        },
      ],
      refused: [
        {
          place: { file: "hone-records/debt/claimed-type.json", index: 0 },
          refusals: [{ kind: "held-at-moved-path", movedTo: "src/moved/a.ts" }],
        },
      ],
      notes: [],
      base: { measured: "yes", held: [], placements: [] },
    });
  });

  it("follows no rename and leaves the base unmeasured, carrying git's message, when the renames are unmeasured", () => {
    expect(
      readingFollowingRenames({
        reading: READING_DEBT_ON_A,
        renamed: {
          measured: "no",
          base: { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad object" },
        },
        moved: [],
      }),
    ).toEqual({
      records: [DEBT_ON_A],
      refused: [],
      notes: [],
      base: {
        measured: "no",
        base: { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad object" },
      },
    });
  });

  it("keeps the reading's own unmeasured base when no base revision was given", () => {
    const unmeasured: RecordsReading = {
      ...READING_DEBT_ON_A,
      base: { measured: "no", base: { state: "not-given" } },
    };
    expect(
      readingFollowingRenames({
        reading: unmeasured,
        renamed: { measured: "no", base: { state: "not-given" } },
        moved: [],
      }),
    ).toEqual(unmeasured);
  });
});

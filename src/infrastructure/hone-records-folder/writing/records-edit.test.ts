import { describe, expect, it } from "vitest";
import { documentsWithAdded, documentsWithRemoved, placeOfAddition } from "./records-edit.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";

const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const OTHER_FILE = repoPathOf("hone-records/debt/date-used-directly.json");

const FIRST = { answers: "claimed-type", file: "src/a.ts" };

const SECOND = { answers: "claimed-type#cast-expressions", file: "src/b.ts" };

const THIRD = { answers: "claimed-type", file: "src/c.ts" };

const HELD = { file: DEBT_FILE, document: { version: 2, records: [FIRST, SECOND] } };

describe("adding records to the documents hone-records holds", () => {
  it("starts a version 2 document for a file no document holds", () => {
    expect(documentsWithAdded({ documents: [], additions: [{ file: DEBT_FILE, entry: FIRST }] })).toEqual({
      outcome: "ok",
      value: [{ file: DEBT_FILE, document: { version: 2, records: [FIRST] } }],
    });
  });

  it("appends to a document, keeping the records it holds as they are", () => {
    expect(documentsWithAdded({ documents: [HELD], additions: [{ file: DEBT_FILE, entry: THIRD }] })).toEqual({
      outcome: "ok",
      value: [{ file: DEBT_FILE, document: { version: 2, records: [FIRST, SECOND, THIRD] } }],
    });
  });

  it("returns only the documents it changed, in the order it first adds to them", () => {
    const added = documentsWithAdded({
      documents: [HELD],
      additions: [
        { file: OTHER_FILE, entry: FIRST },
        { file: DEBT_FILE, entry: THIRD },
        { file: OTHER_FILE, entry: SECOND },
      ],
    });
    expect(added).toEqual({
      outcome: "ok",
      value: [
        { file: OTHER_FILE, document: { version: 2, records: [FIRST, SECOND] } },
        { file: DEBT_FILE, document: { version: 2, records: [FIRST, SECOND, THIRD] } },
      ],
    });
  });

  it("refuses to add to a document that is not a records document, so it never rewrites what it cannot read", () => {
    expect(documentsWithAdded({ documents: [{ file: DEBT_FILE, document: { records: [] } }], additions: [{ file: DEBT_FILE, entry: THIRD }] })).toEqual({
      outcome: "failed",
      error: { kind: "records-documents", refusals: [{ kind: "document-refused", file: DEBT_FILE, issues: expect.any(Array) }] },
    });
  });
});

describe("where an added record would sit", () => {
  it("is the first place of a file no document holds", () => {
    expect(placeOfAddition({ documents: [], addition: { file: DEBT_FILE, entry: FIRST } })).toEqual({ file: DEBT_FILE, index: 0 });
  });

  it("is the place after the records a document holds", () => {
    expect(placeOfAddition({ documents: [HELD], addition: { file: DEBT_FILE, entry: THIRD } })).toEqual({ file: DEBT_FILE, index: 2 });
  });
});

describe("removing records from the documents hone-records holds", () => {
  it("writes the document back without the records at the places, keeping the others as they are", () => {
    expect(documentsWithRemoved({ documents: [HELD], places: [{ file: DEBT_FILE, index: 0 }] })).toEqual({
      outcome: "ok",
      value: { write: [{ file: DEBT_FILE, document: { version: 2, records: [SECOND] } }], remove: [] },
    });
  });

  it("removes a file whose every record is removed", () => {
    expect(
      documentsWithRemoved({
        documents: [HELD],
        places: [
          { file: DEBT_FILE, index: 1 },
          { file: DEBT_FILE, index: 0 },
        ],
      }),
    ).toEqual({ outcome: "ok", value: { write: [], remove: [DEBT_FILE] } });
  });

  it("changes no document it removes nothing from", () => {
    expect(documentsWithRemoved({ documents: [HELD], places: [] })).toEqual({ outcome: "ok", value: { write: [], remove: [] } });
  });

  it("refuses a document that is not a records document", () => {
    expect(documentsWithRemoved({ documents: [{ file: DEBT_FILE, document: "text" }], places: [{ file: DEBT_FILE, index: 0 }] })).toEqual({
      outcome: "failed",
      error: { kind: "records-documents", refusals: [{ kind: "document-refused", file: DEBT_FILE, issues: expect.any(Array) }] },
    });
  });
});

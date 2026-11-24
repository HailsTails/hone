import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../repository/repo-path-of.ts";
import { createRecordsDocument, recordsTextOf } from "./records-edit.ts";

const FIRST = { answers: "claimed-type", file: "src/a.ts" };

describe("the text a records document is written as", () => {
  it("is the document's object at two spaces of indent, then a newline", () => {
    expect(recordsTextOf({ document: { version: 2, records: [FIRST] } })).toBe(
      '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "claimed-type",\n      "file": "src/a.ts"\n    }\n  ]\n}\n',
    );
  });
});

describe("createRecordsDocument", () => {
  it("holds the records under the records version, at their file", () => {
    const file = repoPathOf("hone-records/debt/claimed-type.json");

    const document = createRecordsDocument({ file, records: [FIRST] });

    expect(document).toEqual({ file, document: { version: 2, records: [FIRST] } });
  });
});

import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { readEntries } from "./records-entries.ts";

describe("readEntries", () => {
  it("gives the records a document holds", () => {
    const document = {
      file: repoPathOf("hone-records/debt/claimed-type.json"),
      document: {
        version: 2,
        records: [
          { answers: "claimed-type", file: "src/a.ts" },
          { answers: "claimed-type#cast-expressions", file: "src/b.ts" },
        ],
      },
    };

    const entries = readEntries({ document });

    expect(entries).toEqual({
      outcome: "ok",
      value: [
        { answers: "claimed-type", file: "src/a.ts" },
        { answers: "claimed-type#cast-expressions", file: "src/b.ts" },
      ],
    });
  });

  it("refuses a document that is not a version 2 records document, naming its file", () => {
    const document = {
      file: repoPathOf("hone-records/debt/claimed-type.json"),
      document: { records: [{ answers: "claimed-type", file: "src/a.ts" }] },
    };

    const entries = readEntries({ document });

    expect(entries).toEqual({
      outcome: "failed",
      error: {
        kind: "document-refused",
        file: repoPathOf("hone-records/debt/claimed-type.json"),
        issues: [{ path: ["version"], message: expect.any(String) }],
      },
    });
  });
});

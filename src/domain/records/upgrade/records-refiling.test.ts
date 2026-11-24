import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../repository/repo-path-of.ts";
import { mapHeldRecordsToCurrentNames } from "./records-refiling.ts";

const FORMER_DEBT = repoPathOf("hone-records/debt/code-or-prose-read-as-text.json");

const CURRENT_DEBT = repoPathOf("hone-records/debt/code-or-prose-read-as-text-in-a-test.json");

describe("mapHeldRecordsToCurrentNames", () => {
  it("files a renamed symptom's debt under its current name, renaming each answers, and removes the old file", () => {
    const held = [
      {
        file: FORMER_DEBT,
        records: {
          outcome: "ok",
          value: [{ answers: "code-or-prose-read-as-text#raw-read", file: "src/a.test.ts" }],
        },
      },
    ] as const;

    const refiling = mapHeldRecordsToCurrentNames({ held });

    expect(refiling).toEqual({
      outcome: "ok",
      value: {
        edit: {
          write: [
            {
              file: CURRENT_DEBT,
              document: {
                version: 2,
                records: [
                  {
                    answers: "code-or-prose-read-as-text-in-a-test#raw-read",
                    file: "src/a.test.ts",
                  },
                ],
              },
            },
          ],
          remove: [FORMER_DEBT],
        },
        renamed: [{ from: FORMER_DEBT, to: CURRENT_DEBT, records: 1 }],
      },
    });
  });

  it("appends the moved records after those the current file already holds", () => {
    const kept = {
      answers: "code-or-prose-read-as-text-in-a-test#raw-read",
      file: "src/b.test.ts",
      note: "held",
    };
    const held = [
      { file: CURRENT_DEBT, records: { outcome: "ok", value: [kept] } },
      {
        file: FORMER_DEBT,
        records: {
          outcome: "ok",
          value: [{ answers: "code-or-prose-read-as-text#raw-read", file: "src/a.test.ts" }],
        },
      },
    ] as const;

    const refiling = mapHeldRecordsToCurrentNames({ held });

    expect(refiling).toEqual({
      outcome: "ok",
      value: {
        edit: {
          write: [
            {
              file: CURRENT_DEBT,
              document: {
                version: 2,
                records: [
                  kept,
                  {
                    answers: "code-or-prose-read-as-text-in-a-test#raw-read",
                    file: "src/a.test.ts",
                  },
                ],
              },
            },
          ],
          remove: [FORMER_DEBT],
        },
        renamed: [{ from: FORMER_DEBT, to: CURRENT_DEBT, records: 1 }],
      },
    });
  });

  it("files a deviation under its recipe's current name, renaming the recipe and keeping every other field", () => {
    const deviations = repoPathOf("hone-records/deviations/stub-with-vifn.json");
    const current = repoPathOf("hone-records/deviations/stub-with-vi-fn.json");
    const held = [
      {
        file: deviations,
        records: {
          outcome: "ok",
          value: [{ file: "src/a.test.ts", recipe: "stub-with-vifn", evidence: "e" }],
        },
      },
    ] as const;

    const refiling = mapHeldRecordsToCurrentNames({ held });

    expect(refiling).toEqual({
      outcome: "ok",
      value: {
        edit: {
          write: [
            {
              file: current,
              document: {
                version: 2,
                records: [{ file: "src/a.test.ts", recipe: "stub-with-vi-fn", evidence: "e" }],
              },
            },
          ],
          remove: [deviations],
        },
        renamed: [{ from: deviations, to: current, records: 1 }],
      },
    });
  });

  it("renames a former answers held in a file already under its current name, in place", () => {
    const held = [
      {
        file: CURRENT_DEBT,
        records: {
          outcome: "ok",
          value: [{ answers: "code-or-prose-read-as-text#raw-read", file: "src/a.test.ts" }],
        },
      },
    ] as const;

    const refiling = mapHeldRecordsToCurrentNames({ held });

    expect(refiling).toEqual({
      outcome: "ok",
      value: {
        edit: {
          write: [
            {
              file: CURRENT_DEBT,
              document: {
                version: 2,
                records: [
                  {
                    answers: "code-or-prose-read-as-text-in-a-test#raw-read",
                    file: "src/a.test.ts",
                  },
                ],
              },
            },
          ],
          remove: [],
        },
        renamed: [{ from: CURRENT_DEBT, to: CURRENT_DEBT, records: 1 }],
      },
    });
  });

  it("leaves a team rule set's records alone, since only Hone's own names had former names", () => {
    const held = [
      {
        file: repoPathOf("hone-records/acme/debt/code-or-prose-read-as-text.json"),
        records: {
          outcome: "ok",
          value: [{ answers: "code-or-prose-read-as-text#raw-read", file: "src/a.test.ts" }],
        },
      },
    ] as const;

    const refiling = mapHeldRecordsToCurrentNames({ held });

    expect(refiling).toEqual({
      outcome: "ok",
      value: { edit: { write: [], remove: [] }, renamed: [] },
    });
  });

  it("changes nothing when every record already uses the current names", () => {
    const held = [
      {
        file: CURRENT_DEBT,
        records: {
          outcome: "ok",
          value: [
            { answers: "code-or-prose-read-as-text-in-a-test#raw-read", file: "src/a.test.ts" },
          ],
        },
      },
    ] as const;

    const refiling = mapHeldRecordsToCurrentNames({ held });

    expect(refiling).toEqual({
      outcome: "ok",
      value: { edit: { write: [], remove: [] }, renamed: [] },
    });
  });

  it("leaves a records file it could not read where it is, for the reader to refuse", () => {
    const held = [
      {
        file: FORMER_DEBT,
        records: {
          outcome: "failed",
          error: { kind: "document-refused", file: FORMER_DEBT, issues: [] },
        },
      },
    ] as const;

    const refiling = mapHeldRecordsToCurrentNames({ held });

    expect(refiling).toEqual({
      outcome: "ok",
      value: { edit: { write: [], remove: [] }, renamed: [] },
    });
  });

  it("refuses to append to a current file it could not read, so it never rewrites what it could not read", () => {
    const held = [
      {
        file: CURRENT_DEBT,
        records: {
          outcome: "failed",
          error: { kind: "document-refused", file: CURRENT_DEBT, issues: [] },
        },
      },
      {
        file: FORMER_DEBT,
        records: {
          outcome: "ok",
          value: [{ answers: "code-or-prose-read-as-text#raw-read", file: "src/a.test.ts" }],
        },
      },
    ] as const;

    const refiling = mapHeldRecordsToCurrentNames({ held });

    expect(refiling).toEqual({
      outcome: "failed",
      error: { kind: "document-refused", file: CURRENT_DEBT, issues: [] },
    });
  });
});

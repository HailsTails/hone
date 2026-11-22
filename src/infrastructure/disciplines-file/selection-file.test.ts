import { assert, describe, expect, it } from "vitest";

import { runSettingsOf, selectionFileOf } from "./selection-file.ts";

const SELECTION_PATH = "/repo/disciplines.json";

const CLASS_SYNTAX_RUN = { "CD-14#class-syntax": "walker" };

const documentWith = (request: Readonly<Record<string, unknown>>): Record<string, unknown> => ({
  version: 1,
  ruleSets: {},
  clauses: CLASS_SYNTAX_RUN,
  ...request,
});

const parsed = (document: unknown) => selectionFileOf({ document, path: SELECTION_PATH });

const settingsOf = (document: unknown) => {
  const file = parsed(document);
  assert(file.outcome === "ok", "the selection document is well formed");
  return runSettingsOf({ file: file.value });
};

const MALFORMED = { outcome: "failed", error: { kind: "file-malformed", path: SELECTION_PATH } };

describe("selectionFileOf reading the selection", () => {
  it("reads a shared and a named clause with their rule sets and mechanisms", () => {
    expect(
      parsed({
        version: 1,
        ruleSets: { team: "team-rules" },
        clauses: { "CD-14#class-syntax": "walker", "team/TM-1#no-tmp-files": "walker" },
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        ruleSets: [["team", { location: "folder", path: "team-rules" }]],
        clauses: [
          [
            { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
            { state: "run", mechanism: "walker" },
          ],
          [
            { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" },
            { state: "run", mechanism: "walker" },
          ],
        ],
      },
    });
  });

  it("reads a hone-prefixed clause as the same bare-addressed hone clause", () => {
    expect(
      parsed(documentWith({ clauses: { "hone/CD-14#class-syntax": "walker" } })),
    ).toMatchObject({
      outcome: "ok",
      value: {
        clauses: [
          [
            { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
            { state: "run", mechanism: "walker" },
          ],
        ],
      },
    });
  });

  it("reads a rule set declared as . as rooted at the repo root", () => {
    expect(parsed(documentWith({ ruleSets: { team: "." } }))).toMatchObject({
      outcome: "ok",
      value: { ruleSets: [["team", { location: "repo-root" }]] },
    });
  });

  it("reads the not-run and not-adopted clause states", () => {
    expect(
      parsed(
        documentWith({
          clauses: { "CD-14#class-syntax": "not-run", "CD-14#abstract-syntax": "not-adopted" },
        }),
      ),
    ).toMatchObject({
      outcome: "ok",
      value: {
        clauses: [
          [expect.anything(), { state: "not-run" }],
          [expect.anything(), { state: "not-adopted" }],
        ],
      },
    });
  });

  it("reads the paths disciplines.json excludes from checking", () => {
    expect(parsed(documentWith({ exclude: ["vendor", "src/generated.ts"] }))).toMatchObject({
      outcome: "ok",
      value: { exclude: ["vendor", "src/generated.ts"] },
    });
  });

  it("reads optional file exception why-chains when disciplines.json makes them optional", () => {
    expect(parsed(documentWith({ fileExceptionWhyChains: "optional" }))).toMatchObject({
      outcome: "ok",
      value: { fileExceptionWhyChains: "optional" },
    });
  });

  it("accepts package folders disciplines.json declares as ESLint config roots", () => {
    expect(parsed(documentWith({ eslintConfigRoots: ["packages/a", "apps/web"] }))).toMatchObject({
      outcome: "ok",
      value: { eslintConfigRoots: ["packages/a", "apps/web"] },
    });
  });

  it("accepts a team rule-set name that only starts with the letters hone", () => {
    expect(
      parsed(documentWith({ ruleSets: { honeycomb: "team-rules" }, clauses: {} })),
    ).toMatchObject({ outcome: "ok" });
  });

  it("accepts declared rule-set names that merely share leading letters", () => {
    expect(
      parsed(documentWith({ ruleSets: { acme: "acme-rules", acmeco: "co-rules" }, clauses: {} })),
    ).toMatchObject({ outcome: "ok" });
  });

  it("accepts the rule-set name shared as a team's own", () => {
    expect(parsed(documentWith({ ruleSets: { shared: "team-rules" }, clauses: {} }))).toMatchObject(
      { outcome: "ok" },
    );
  });
});

describe("selectionFileOf refusing a malformed selection", () => {
  it.each([
    ["an extra top-level key", { mechanisms: {} }],
    ["a clauses key that is not a clause address", { clauses: { "CD-14 class-syntax": "walker" } }],
    [
      "a ruleSets key the rule-set name schema refuses",
      { ruleSets: { "team rules": "team-rules" }, clauses: {} },
    ],
    ["a ruleSets value that is not a string", { ruleSets: { team: 7 }, clauses: {} }],
    [
      "a ruleSets value written with a backslash",
      { ruleSets: { team: "tools\\disciplines" }, clauses: {} },
    ],
    ["an absolute ruleSets value", { ruleSets: { team: "/abs" }, clauses: {} }],
    ["a clauses value that is not a mechanism id", { clauses: { "CD-14#class-syntax": "Walker" } }],
    [
      "file exception why-chains other than required or optional",
      { fileExceptionWhyChains: "off" },
    ],
    ["an ESLint config root that is not a repository path", { eslintConfigRoots: ["../outside"] }],
    ["an excluded path that is not a repository path", { exclude: ["../outside"] }],
    ["an excluded glob", { exclude: ["src/**/generated"] }],
    ["a checkEditions value it does not know", { checkEditions: "newest" }],
  ])("is file-malformed for %s", (_shape, request) => {
    expect(parsed(documentWith(request))).toMatchObject(MALFORMED);
  });

  it("names the folder rule when an ESLint config root is a glob", () => {
    expect(parsed(documentWith({ eslintConfigRoots: ["packages/*"] }))).toMatchObject({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail: expect.stringContaining(
          "an eslintConfigRoots entry is a repository folder, not a glob",
        ),
      },
    });
  });

  it("reports both the repository-path and the glob refusal when an exclude entry is an absolute glob", () => {
    expect(parsed(documentWith({ exclude: ["/a*"] }))).toMatchObject({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        detail: expect.stringMatching(
          /not a repo-relative path[\s\S]*an exclude entry is a repository path, not a glob/,
        ),
      },
    });
  });

  it("names every accepted form when a clauses value is neither a mechanism id nor a clause state", () => {
    expect(parsed(documentWith({ clauses: { "CD-14#class-syntax": "Walker" } }))).toMatchObject({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail: expect.stringContaining(
          'a clause takes a mechanism id, "not-run" or "not-adopted"',
        ),
      },
    });
  });
});

describe("selectionFileOf refusing a rule-set name or clause", () => {
  it("refuses the rule-set name hone as reserved-rule-set-name", () => {
    expect(parsed(documentWith({ ruleSets: { hone: "team-rules" }, clauses: {} }))).toEqual({
      outcome: "failed",
      error: { kind: "reserved-rule-set-name", name: "hone" },
    });
  });

  it.each(["hone-extras", "hone-"])(
    "refuses the rule-set name %s as reserved-rule-set-name",
    (name) => {
      expect(parsed(documentWith({ ruleSets: { [name]: "team-rules" }, clauses: {} }))).toEqual({
        outcome: "failed",
        error: { kind: "reserved-rule-set-name", name },
      });
    },
  );

  it("refuses one declared rule-set name that is another plus a suffix, naming both", () => {
    expect(
      parsed(documentWith({ ruleSets: { "acme-x": "x-rules", acme: "acme-rules" }, clauses: {} })),
    ).toEqual({
      outcome: "failed",
      error: { kind: "rule-set-name-collision", name: "acme", other: "acme-x" },
    });
  });

  it("refuses a clause selected twice, once bare and once with the hone prefix", () => {
    expect(
      parsed(
        documentWith({
          clauses: { "CD-14#class-syntax": "walker", "hone/CD-14#class-syntax": "eslint" },
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "duplicate-clause",
        address: "CD-14#class-syntax",
        prefixedAddress: "hone/CD-14#class-syntax",
      },
    });
  });

  it("refuses a clause both adopted and not adopted, bare and hone-prefixed, as duplicate-clause", () => {
    expect(
      parsed(
        documentWith({
          clauses: { "CD-14#class-syntax": "walker", "hone/CD-14#class-syntax": "not-adopted" },
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "duplicate-clause",
        address: "CD-14#class-syntax",
        prefixedAddress: "hone/CD-14#class-syntax",
      },
    });
  });
});

describe("selectionFileOf with clauseSettings", () => {
  it("reads the settings given to a selected clause", () => {
    expect(
      parsed(documentWith({ clauseSettings: { "CD-14#class-syntax": { style: "strict" } } })),
    ).toMatchObject({
      outcome: "ok",
      value: {
        clauseSettings: [
          [{ ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" }, { style: "strict" }],
        ],
      },
    });
  });

  it("matches a hone-prefixed clauseSettings key to the bare selected clause", () => {
    expect(
      parsed(documentWith({ clauseSettings: { "hone/CD-14#class-syntax": { style: "strict" } } })),
    ).toMatchObject({
      outcome: "ok",
    });
  });

  it("refuses one clause given settings twice, bare and hone-prefixed, naming both", () => {
    expect(
      parsed(
        documentWith({
          clauseSettings: {
            "CD-14#class-syntax": { style: "plain" },
            "hone/CD-14#class-syntax": { style: "strict" },
          },
        }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail: expect.stringContaining(
          "clauseSettings for CD-14#class-syntax: given twice, also as hone/CD-14#class-syntax",
        ),
      },
    });
  });

  it.each([
    {
      name: "a key that is not a clause address",
      clauseSettings: { "CD-14 class-syntax": { limit: 1 } },
      message: "clauseSettings for CD-14 class-syntax: not a clause address",
    },
    {
      name: "a clause the file does not select",
      clauseSettings: { "CD-14#decorator-syntax": { limit: 1 } },
      message: "clauseSettings for CD-14#decorator-syntax: clauses does not select it",
    },
  ])("names the key text when clauseSettings holds $name", ({ clauseSettings, message }) => {
    expect(parsed(documentWith({ clauseSettings }))).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail: expect.stringContaining(message),
      },
    });
  });

  it("is file-malformed for settings that are not an object", () => {
    expect(
      parsed(documentWith({ clauseSettings: { "CD-14#class-syntax": ["Widget"] } })),
    ).toMatchObject(MALFORMED);
  });

  it("refuses clauseSettings for a not-adopted clause as file-malformed, naming it not adopted", () => {
    expect(
      parsed(
        documentWith({
          clauses: { "CD-14#class-syntax": "not-adopted", "CD-14#abstract-syntax": "walker" },
          clauseSettings: { "CD-14#class-syntax": { style: "strict" } },
        }),
      ),
    ).toMatchObject({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail: expect.stringContaining(
          "clauseSettings for CD-14#class-syntax: clauses does not adopt it, so remove its settings",
        ),
      },
    });
  });

  it("refuses clauseSettings for a not-run clause as file-malformed, saying its mechanism does not run", () => {
    expect(
      parsed(
        documentWith({
          clauses: { "CD-14#class-syntax": "not-run", "CD-14#abstract-syntax": "walker" },
          clauseSettings: { "CD-14#class-syntax": { style: "strict" } },
        }),
      ),
    ).toMatchObject({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail: expect.stringContaining(
          "clauseSettings for CD-14#class-syntax: clauses runs no mechanism for it, so remove its settings",
        ),
      },
    });
  });
});

describe("runSettingsOf", () => {
  it("is the full report and the default assessment when disciplines.json sets neither", () => {
    expect(settingsOf({ version: 1, ruleSets: {}, clauses: {} })).toEqual({
      reportOutput: "full",
      assessment: { forfeiture: "this-run" },
    });
  });

  it.each(["full", "failures-only", "counts", "verdict-only"])(
    "reads the report output %s from disciplines.json",
    (reportOutput) => {
      expect(settingsOf(documentWith({ reportOutput })).reportOutput).toBe(reportOutput);
    },
  );

  it.each([
    ["a name that is not one of the four", "summary"],
    ["null", null],
    ["a number", 3],
    ["a list", ["full"]],
  ])(
    "is file-malformed when disciplines.json gives the report output as %s",
    (_shape, reportOutput) => {
      expect(parsed(documentWith({ reportOutput }))).toMatchObject(MALFORMED);
    },
  );

  it.each(["this-run", "elsewhere"])(
    "reads the forfeiture assessment %s from disciplines.json",
    (forfeiture) => {
      expect(settingsOf(documentWith({ assessment: { forfeiture } })).assessment).toEqual({
        forfeiture,
      });
    },
  );

  it("is the default assessment for an empty assessment object", () => {
    expect(settingsOf(documentWith({ assessment: {} })).assessment).toEqual({
      forfeiture: "this-run",
    });
  });

  it.each([
    [
      "an eslint key, which is not built",
      { eslint: { evidence: "results-file", paths: ["reports/eslint.json"] } },
    ],
    ["the removed waivedClauses key", { waivedClauses: "not-run" }],
    ["a forfeiture that is not one of the two", { forfeiture: "reported" }],
    ["a list", ["elsewhere"]],
  ])("is file-malformed when disciplines.json gives the assessment %s", (_shape, assessment) => {
    expect(parsed(documentWith({ assessment }))).toMatchObject(MALFORMED);
  });

  it("names the removed waivedClauses with the clause states that replace it, then each unbuilt key", () => {
    expect(
      parsed(
        documentWith({ assessment: { eslint: { evidence: "hone" }, waivedClauses: "not-run" } }),
      ),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail:
          '✖ removed: "waivedClauses"; in clauses, mark a clause "not-run" when its mechanism does not run, or "not-adopted" when its rule does not apply; see MIGRATING.md section 12. not available in this version: "eslint"; assessment takes "forfeiture" only\n  → at assessment',
      },
    });
  });

  it("reads the run settings without resolving the selected clauses", () => {
    expect(
      settingsOf({
        version: 1,
        ruleSets: {},
        clauses: { "CD-99#missing": "walker" },
        reportOutput: "counts",
        assessment: { forfeiture: "elsewhere" },
      }),
    ).toEqual({ reportOutput: "counts", assessment: { forfeiture: "elsewhere" } });
  });
});

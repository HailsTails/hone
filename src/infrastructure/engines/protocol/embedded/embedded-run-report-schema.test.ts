import { describe, expect, it } from "vitest";

import { embeddedRunReportSchema } from "./embedded-run-report-schema.ts";

const CLASS_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const HIT_IN_A = {
  clause: CLASS_SYNTAX,
  file: "src/a.ts",
  anchor: { line: 3, column: 2 },
  snippet: "class A {}",
};

const EVERY_NATIVE_KIND = [
  { kind: "ignore", clause: CLASS_SYNTAX, file: "src/generated.ts" },
  { kind: "config-override", clause: CLASS_SYNTAX, file: "src/legacy.ts" },
  {
    kind: "suppression-entry",
    clause: CLASS_SYNTAX,
    file: "src/old.ts",
    location: "eslint-suppressions.json",
  },
  {
    kind: "inline-disable",
    clause: CLASS_SYNTAX,
    file: "src/a.ts",
    line: 4,
    text: "// eslint-disable-next-line hone/no-class-authoring",
    reach: "one-clause",
  },
  {
    kind: "inline-rule-config",
    clause: CLASS_SYNTAX,
    file: "src/a.ts",
    line: 1,
    text: '/* eslint hone/no-class-authoring: "off" */',
  },
  {
    kind: "command-line-option",
    clause: CLASS_SYNTAX,
    location: "package.json",
    script: "lint",
    option: "--suppress-all",
    cause: { kind: "weakens-run" },
  },
];

const CHECK = "authored-class-or-this#class-keyword";

const EVERY_NATIVE_KIND_NAMING_A_CHECK = [
  { kind: "ignore", check: CHECK, clause: CLASS_SYNTAX, file: "src/generated.ts" },
  { kind: "config-override", check: CHECK, clause: CLASS_SYNTAX, file: "src/legacy.ts" },
  {
    kind: "suppression-entry",
    check: CHECK,
    clause: CLASS_SYNTAX,
    file: "src/old.ts",
    location: "eslint-suppressions.json",
  },
  {
    kind: "inline-disable",
    check: CHECK,
    clause: CLASS_SYNTAX,
    file: "src/a.ts",
    line: 4,
    text: "// eslint-disable-next-line hone/authored-class-or-this#class-keyword",
    reach: "one-clause",
  },
  {
    kind: "inline-rule-config",
    check: CHECK,
    clause: CLASS_SYNTAX,
    file: "src/a.ts",
    line: 1,
    text: '/* eslint hone/authored-class-or-this#class-keyword: "off" */',
  },
  {
    kind: "command-line-option",
    check: CHECK,
    clause: CLASS_SYNTAX,
    location: "package.json",
    script: "lint",
    option: "--suppress-all",
    cause: { kind: "weakens-run" },
  },
];

const EMPTY_CHECK_ON_A_NATIVE_EXCEPTION = [
  { kind: "ignore", check: "", clause: CLASS_SYNTAX, file: "src/generated.ts" },
];

describe("embeddedRunReportSchema, a hit and a native exception naming their check", () => {
  it("keeps the check on a hit and on each of the six native exception kinds", () => {
    const report = {
      hits: [{ ...HIT_IN_A, check: CHECK }],
      nativeExceptions: EVERY_NATIVE_KIND_NAMING_A_CHECK,
      projection: "current",
      slices: [],
      unprojectedFolders: [],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("rejects an empty check on a hit", () => {
    const report = {
      hits: [{ ...HIT_IN_A, check: "" }],
      nativeExceptions: [],
      projection: "current",
      slices: [],
      unprojectedFolders: [],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects an empty check on a native exception", () => {
    const report = {
      hits: [],
      nativeExceptions: EMPTY_CHECK_ON_A_NATIVE_EXCEPTION,
      projection: "current",
      slices: [],
      unprojectedFolders: [],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report).success).toBe(false);
  });
});

describe("embeddedRunReportSchema", () => {
  it("accepts a report holding a hit, one native exception of every kind and a not-included projection", () => {
    const report = {
      hits: [HIT_IN_A],
      nativeExceptions: EVERY_NATIVE_KIND,
      projection: "not-included",
      slices: [],
      unprojectedFolders: [],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("accepts a current projection with no hits and no native exceptions", () => {
    const report = {
      hits: [],
      nativeExceptions: [],
      projection: "current",
      slices: [],
      unprojectedFolders: [],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("accepts an out-of-date projection", () => {
    const report = {
      hits: [HIT_IN_A],
      nativeExceptions: [],
      projection: "out-of-date",
      slices: [],
      unprojectedFolders: [],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("accepts a missing projection", () => {
    const report = {
      hits: [],
      nativeExceptions: [],
      projection: "missing",
      slices: [],
      unprojectedFolders: [],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("accepts a package slice that is out of date, missing or not applied beside a current root projection", () => {
    const report = {
      hits: [],
      nativeExceptions: [],
      projection: "current",
      slices: [
        { slice: "packages/a/disciplines.eslint.mjs", state: "out-of-date" },
        { slice: "packages/b/disciplines.eslint.mjs", state: "missing" },
        { slice: "packages/c/disciplines.eslint.mjs", state: "not-applied" },
      ],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({
      success: true,
      data: { ...report, unprojectedFolders: [] },
    });
  });

  it("reads the folders a runner names as ones whose files load a config the projection does not reach", () => {
    const report = {
      hits: [],
      nativeExceptions: [],
      projection: "current",
      slices: [],
      unprojectedFolders: [{ folder: "fixtures/deep/tool", selectionFolder: "fixtures/deep" }],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("reads the clause and file pairs a runner names as measured", () => {
    const report = {
      hits: [],
      nativeExceptions: [],
      projection: "current",
      slices: [],
      unprojectedFolders: [],
      measured: [{ clause: CLASS_SYNTAX, file: "src/a.ts" }],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("refuses a measured file that is not a repo path, within that pair", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [],
        projection: "current",
        measured: [{ clause: CLASS_SYNTAX, file: "/repo/src/a.ts" }],
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["measured", 0, "file"] }] } });
  });

  it("refuses an unprojected folder that is not a repo path", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [],
        projection: "current",
        unprojectedFolders: [{ folder: "/repo/fixtures", selectionFolder: "fixtures" }],
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: ["unprojectedFolders", 0, "folder"] }] },
    });
  });

  it("reads a report from a runner that names no slices as having no slice problems", () => {
    expect(
      embeddedRunReportSchema.safeParse({ hits: [], nativeExceptions: [], projection: "current" }),
    ).toEqual({
      success: true,
      data: {
        hits: [],
        nativeExceptions: [],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
      },
    });
  });

  it("refuses a slice whose path is not a repo path, within that slice", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [],
        projection: "current",
        slices: [{ slice: "/repo/packages/a/disciplines.eslint.mjs", state: "missing" }],
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["slices", 0]) }] },
    });
  });

  it("refuses a slice state outside the three, at that slice's state", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [],
        projection: "current",
        slices: [{ slice: "packages/a/disciplines.eslint.mjs", state: "stale" }],
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["slices", 0, "state"] }] } });
  });

  it("refuses a projection state outside the four, at the projection key", () => {
    expect(
      embeddedRunReportSchema.safeParse({ hits: [], nativeExceptions: [], projection: "stale" }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["projection"] }] } });
  });

  it("refuses the standalone none as a projection state, at the projection key", () => {
    expect(
      embeddedRunReportSchema.safeParse({ hits: [], nativeExceptions: [], projection: "none" }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["projection"] }] } });
  });

  it("refuses a native exception of an unknown kind, within that exception", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [{ kind: "baseline", clause: CLASS_SYNTAX, file: "src/a.ts" }],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["nativeExceptions", 0]) }] },
    });
  });

  it("refuses a native exception whose file is not a repo path, within that exception", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "/repo/src/a.ts" }],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["nativeExceptions", 0]) }] },
    });
  });

  it("refuses an inline disable with no line, within that exception", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "src/a.ts",
            text: "// eslint-disable",
            reach: "every-selected-clause",
          },
        ],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["nativeExceptions", 0]) }] },
    });
  });

  it("accepts an inline disable that names no rule and so reaches every selected clause", () => {
    const report = {
      hits: [],
      nativeExceptions: [
        {
          kind: "inline-disable",
          clause: CLASS_SYNTAX,
          file: "src/a.ts",
          line: 1,
          text: "/* eslint-disable */",
          reach: "every-selected-clause",
        },
      ],
      projection: "current",
      slices: [],
      unprojectedFolders: [],
      measured: [],
    };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("refuses an inline disable with no reach, within that exception", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "src/a.ts",
            line: 1,
            text: "// eslint-disable-line",
          },
        ],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["nativeExceptions", 0]) }] },
    });
  });

  it("refuses a hit whose file is not a repo path, within that hit", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [{ ...HIT_IN_A, file: "/repo/src/a.ts" }],
        nativeExceptions: [],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["hits", 0]) }] },
    });
  });

  it("refuses a report with no projection, at the projection key", () => {
    expect(embeddedRunReportSchema.safeParse({ hits: [], nativeExceptions: [] })).toMatchObject({
      success: false,
      error: { issues: [{ path: ["projection"] }] },
    });
  });
});

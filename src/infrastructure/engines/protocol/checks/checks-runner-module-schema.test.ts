import { describe, expect, it } from "vitest";

import {
  checksProjectResultSchema,
  namedChecksRunnerModuleSchema,
  namedChecksRunResultSchema,
  isChecksSliceProblemSchemaEqual,
  isMisnamedRuleIdSchemaEqual,
  isNotReadyYetFailureSchemaEqual,
  isProjectedFileSchemaEqual,
  misnamedRuleIdSchema,
} from "./checks-runner-module-schema.ts";

const REPORT = {
  hits: [
    {
      file: "src/a.ts",
      anchor: { line: 1, column: 7 },
      snippet: "export class A {}",
      check: "authored-class-or-this#class-keyword",
    },
  ],
  nativeExceptions: [
    {
      kind: "ignore",
      check: "authored-class-or-this#class-keyword",
      file: "src/gen.ts",
    },
  ],
  measured: [{ check: "authored-class-or-this#class-keyword", file: "src/a.ts" }],
  projection: "current",
  slices: [{ slice: "packages/web/hone.eslint.mjs", state: "out-of-date" }],
  misnamedRuleIds: [
    {
      kind: "version-1-id",
      ruleId: "hone/no-class-authoring",
      file: "src/a.ts",
      line: 2,
      text: "// eslint-disable-next-line hone/no-class-authoring",
      replacedBy: ["hone/authored-class-or-this#class-keyword"],
    },
  ],
};

describe("the checks runner's ties to its module schema", () => {
  it("declares each required runner capability and its projected kinds", () => {
    expect(Object.keys(namedChecksRunnerModuleSchema.shape).sort()).toEqual([
      "conform",
      "fileScope",
      "project",
      "projectedKinds",
      "run",
    ]);
  });

  it("holds the same slice problem, misnamed rule id, not-ready-yet failure and projected file as the types", () => {
    expect([
      isChecksSliceProblemSchemaEqual,
      isMisnamedRuleIdSchemaEqual,
      isNotReadyYetFailureSchemaEqual,
      isProjectedFileSchemaEqual,
    ]).toEqual([true, true, true, true]);
  });
});

const MISNAMED_SITE = {
  ruleId: "hone/no-class-authoring",
  file: "src/a.ts",
  line: 2,
  text: "// eslint-disable-next-line hone/no-class-authoring",
};

describe("misnamedRuleIdSchema", () => {
  it("accepts a version 1 id naming the version 2 ids to write, and an id naming no check", () => {
    expect([
      misnamedRuleIdSchema.safeParse({
        kind: "version-1-id",
        ...MISNAMED_SITE,
        replacedBy: ["hone/a#first", "hone/a#second"],
      }).success,
      misnamedRuleIdSchema.safeParse({ kind: "names-no-check", ...MISNAMED_SITE }).success,
    ]).toEqual([true, true]);
  });

  it("rejects a version 1 id that names no version 2 id to write", () => {
    expect([
      misnamedRuleIdSchema.safeParse({ kind: "version-1-id", ...MISNAMED_SITE, replacedBy: [] })
        .success,
      misnamedRuleIdSchema.safeParse({ kind: "version-1-id", ...MISNAMED_SITE }).success,
      misnamedRuleIdSchema.safeParse({ kind: "version-1-id", ...MISNAMED_SITE, replacedBy: [""] })
        .success,
    ]).toEqual([false, false, false]);
  });

  it("rejects an id naming no check that carries a version 2 id", () => {
    expect(
      misnamedRuleIdSchema.safeParse({
        kind: "names-no-check",
        ...MISNAMED_SITE,
        replacedBy: ["hone/a#first"],
      }).success,
    ).toBe(false);
  });
});

describe("namedChecksRunnerModuleSchema", () => {
  it("accepts a module exporting the native exception kinds it projects, a run, a conform and a project", () => {
    const module = {
      fileScope: "tracked",
      projectedKinds: ["config-override", "inline-disable"],
      run: () => Promise.resolve(undefined),
      conform: () => Promise.resolve(undefined),
      project: () => Promise.resolve(undefined),
    };
    expect(namedChecksRunnerModuleSchema.safeParse(module).success).toBe(true);
  });

  it("rejects a module whose run is not a function", () => {
    expect(
      namedChecksRunnerModuleSchema.safeParse({
        fileScope: "tracked",
        projectedKinds: [],
        run: "run",
        conform: () => Promise.resolve(undefined),
        project: () => Promise.resolve(undefined),
      }).success,
    ).toBe(false);
  });

  it("rejects a module with no conform, at the conform key", () => {
    const module = {
      fileScope: "tracked",
      projectedKinds: [],
      run: () => Promise.resolve(undefined),
      project: () => Promise.resolve(undefined),
    };
    expect(namedChecksRunnerModuleSchema.safeParse(module)).toMatchObject({
      success: false,
      error: { issues: [{ path: ["conform"] }] },
    });
  });

  it("rejects a module whose conform is not a function", () => {
    expect(
      namedChecksRunnerModuleSchema.safeParse({
        fileScope: "tracked",
        projectedKinds: [],
        run: () => Promise.resolve(undefined),
        conform: "conform",
        project: () => Promise.resolve(undefined),
      }).success,
    ).toBe(false);
  });

  it("rejects a module with no project, at the project key", () => {
    const module = {
      fileScope: "tracked",
      projectedKinds: [],
      run: () => Promise.resolve(undefined),
      conform: () => Promise.resolve(undefined),
    };
    expect(namedChecksRunnerModuleSchema.safeParse(module)).toMatchObject({
      success: false,
      error: { issues: [{ path: ["project"] }] },
    });
  });

  it("rejects a module whose project is not a function", () => {
    expect(
      namedChecksRunnerModuleSchema.safeParse({
        fileScope: "tracked",
        projectedKinds: [],
        run: () => Promise.resolve(undefined),
        conform: () => Promise.resolve(undefined),
        project: "project",
      }).success,
    ).toBe(false);
  });
});

describe("checksProjectResultSchema", () => {
  it("accepts the files to write, keeping every field", () => {
    const projected = {
      outcome: "ok",
      value: [{ file: "hone.eslint.mjs", text: "export default [];\n" }],
    };
    expect(checksProjectResultSchema.safeParse(projected)).toEqual({
      success: true,
      data: projected,
    });
  });

  it("accepts a runner failure", () => {
    const failed = { outcome: "failed", error: { kind: "tool-failed", detail: "disk full" } };
    expect(checksProjectResultSchema.safeParse(failed)).toEqual({ success: true, data: failed });
  });

  it("accepts a not-ready-yet failure", () => {
    const notReady = {
      outcome: "failed",
      error: {
        kind: "not-ready-yet",
        what: { thing: "eslint-config-roots", paths: ["packages/web"] },
      },
    };
    expect(checksProjectResultSchema.safeParse(notReady)).toEqual({
      success: true,
      data: notReady,
    });
  });

  it("rejects a value that is not a list of files to write", () => {
    expect(checksProjectResultSchema.safeParse({ outcome: "ok", value: "written" }).success).toBe(
      false,
    );
  });
});

describe("namedChecksRunResultSchema", () => {
  it("accepts a report naming checks and misnamed rule ids, keeping every field", () => {
    expect(namedChecksRunResultSchema.safeParse({ outcome: "ok", value: REPORT })).toEqual({
      success: true,
      data: { outcome: "ok", value: REPORT },
    });
  });

  it("accepts a runner failure", () => {
    const failed = { outcome: "failed", error: { kind: "tool-failed", detail: "ESLint stopped" } };
    expect(namedChecksRunResultSchema.safeParse(failed)).toEqual({ success: true, data: failed });
  });

  it("accepts the not-ready-yet failure the ESLint runner gives for config roots", () => {
    const failed = {
      outcome: "failed",
      error: {
        kind: "not-ready-yet",
        what: { thing: "eslint-config-roots", paths: ["packages/web"] },
      },
    };
    expect(namedChecksRunResultSchema.safeParse(failed)).toEqual({ success: true, data: failed });
  });

  it("rejects a not-ready-yet failure that names no path", () => {
    const failed = {
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: [] } },
    };
    expect(namedChecksRunResultSchema.safeParse(failed).success).toBe(false);
  });

  it("rejects a misnamed rule id of an unknown kind", () => {
    const report = {
      ...REPORT,
      misnamedRuleIds: [{ ...REPORT.misnamedRuleIds[0], kind: "misspelt" }],
    };
    expect(namedChecksRunResultSchema.safeParse({ outcome: "ok", value: report }).success).toBe(
      false,
    );
  });

  it("rejects a report that leaves out the misnamed rule ids", () => {
    const { misnamedRuleIds: _left, ...withoutMisnamed } = REPORT;
    expect(
      namedChecksRunResultSchema.safeParse({ outcome: "ok", value: withoutMisnamed }).success,
    ).toBe(false);
  });

  it("rejects a report that leaves out the slice problems", () => {
    const { slices: _left, ...withoutSlices } = REPORT;
    expect(
      namedChecksRunResultSchema.safeParse({ outcome: "ok", value: withoutSlices }).success,
    ).toBe(false);
  });

  it("rejects a slice problem in a state that is not a slice state", () => {
    const report = {
      ...REPORT,
      slices: [{ slice: "packages/web/hone.eslint.mjs", state: "stale" }],
    };
    expect(namedChecksRunResultSchema.safeParse({ outcome: "ok", value: report }).success).toBe(
      false,
    );
  });

  it("rejects the slice states that only a version 1 runner reports", () => {
    const notApplied = {
      ...REPORT,
      slices: [{ slice: "packages/web/hone.eslint.mjs", state: "not-applied" }],
    };
    const nested = {
      ...REPORT,
      slices: [{ slice: "packages/web/hone.eslint.mjs", state: "nested-configuration" }],
    };
    expect([
      namedChecksRunResultSchema.safeParse({ outcome: "ok", value: notApplied }).success,
      namedChecksRunResultSchema.safeParse({ outcome: "ok", value: nested }).success,
    ]).toEqual([false, false]);
  });

  it("accepts a package file that is missing, out of date, or that nothing loads", () => {
    const report = {
      ...REPORT,
      slices: [
        { slice: "packages/a/hone.eslint.mjs", state: "missing" },
        { slice: "packages/b/hone.eslint.mjs", state: "out-of-date" },
        { slice: "packages/c/hone.eslint.mjs", state: "unconfigured" },
      ],
    };
    expect(namedChecksRunResultSchema.safeParse({ outcome: "ok", value: report })).toEqual({
      success: true,
      data: { outcome: "ok", value: report },
    });
  });
});

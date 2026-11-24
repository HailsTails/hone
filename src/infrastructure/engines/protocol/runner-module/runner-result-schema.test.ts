import { describe, expect, it } from "vitest";

import type { CaseVerdict } from "../../../../domain/runner/runner-result-types.ts";
import {
  caseVerdictSchema,
  hitSchema,
  projectionWriteSchema,
  runnerResultSchema,
} from "./runner-result-schema.ts";
import type { Equal } from "./type-equality.ts";

const sharedClause = {
  ruleSet: "hone",
  discipline: "CD-14",
  clause: "no-class-syntax",
};

const hit = {
  clause: sharedClause,
  file: "src/a.ts",
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
};

const FORTY = "class A {} class B {} class C {} class D";

const LIMIT_LONG_SNIPPET = `${FORTY}${FORTY}${FORTY}${FORTY}${FORTY}`;

const write = { path: "eslint.config.js", effect: "written" };

describe("hitSchema", () => {
  it("accepts a hit naming a clause address, a repository file, an anchor and a snippet", () => {
    expect(hitSchema.safeParse(hit)).toEqual({ success: true, data: hit });
  });

  it("accepts a hit on a named rule set's clause", () => {
    expect(
      hitSchema.safeParse({
        clause: { ruleSet: { name: "probe" }, discipline: "PD-1", clause: "no-tmp-files" },
        file: "src/a.ts",
        anchor: { line: 1, column: 1 },
        snippet: "tmp",
      }).success,
    ).toBe(true);
  });

  it("cuts a snippet longer than the snippet limit, so one long line cannot flood the report", () => {
    expect(hitSchema.parse({ ...hit, snippet: `${LIMIT_LONG_SNIPPET}tail` })).toEqual({
      ...hit,
      snippet: `${LIMIT_LONG_SNIPPET}…`,
    });
  });

  it("refuses a hit whose file is not a repository path", () => {
    expect(hitSchema.safeParse({ ...hit, file: "/repo/src/a.ts" }).success).toBe(false);
  });

  it("accepts a hit anchored at line 1, column 0", () => {
    expect(hitSchema.safeParse({ ...hit, anchor: { line: 1, column: 0 } }).success).toBe(true);
  });

  it("refuses a hit anchored at line 0", () => {
    expect(hitSchema.safeParse({ ...hit, anchor: { line: 0, column: 5 } }).success).toBe(false);
  });

  it("accepts a hit whose piece names a fix and the form that shows it", () => {
    const remedied = {
      ...hit,
      remedy: { fix: "write a factory", form: "a-class-and-its-factory" },
    };

    expect(hitSchema.safeParse(remedied)).toEqual({ success: true, data: remedied });
  });

  it("keeps no page a remedy names, leaving the page to the check", () => {
    const paged = {
      ...hit,
      remedy: { fix: "write a factory", page: "CHECKS.md", form: "a-class-and-its-factory" },
    };

    expect(hitSchema.safeParse(paged)).toEqual({
      success: true,
      data: { ...hit, remedy: { fix: "write a factory", form: "a-class-and-its-factory" } },
    });
  });

  it.each([
    { name: "a package subpath", importSpecifier: "lodash/fp" },
    { name: "a scheme module", importSpecifier: "node:fs" },
    { name: "a scoped package subpath", importSpecifier: "@scope/pkg/sub" },
  ])(
    "keeps the import specifier that raised the hit, $name, exactly as the source wrote it",
    ({ importSpecifier }) => {
      const imported = { ...hit, importSpecifier };

      expect(hitSchema.safeParse(imported)).toEqual({ success: true, data: imported });
    },
  );

  it("refuses an empty import specifier", () => {
    expect(hitSchema.safeParse({ ...hit, importSpecifier: "" }).success).toBe(false);
  });

  it.each([
    { name: "an empty fix", remedy: { fix: "", form: "a-class" } },
    { name: "a form with a space", remedy: { fix: "write a factory", form: "a class" } },
    { name: "a form with a capital", remedy: { fix: "write a factory", form: "A-class" } },
    { name: "a form with a leading hash", remedy: { fix: "write a factory", form: "#a-class" } },
    { name: "no form", remedy: { fix: "write a factory" } },
  ])("refuses a remedy with $name", ({ remedy }) => {
    expect(hitSchema.safeParse({ ...hit, remedy }).success).toBe(false);
  });
});

describe("caseVerdictSchema", () => {
  it("accepts a case name with its flagged lines", () => {
    expect(caseVerdictSchema.safeParse({ caseName: "class", flaggedLines: [1, 4] })).toEqual({
      success: true,
      data: { caseName: "class", flaggedLines: [1, 4] },
    });
  });

  it("refuses flagged lines that are not numbers", () => {
    expect(caseVerdictSchema.safeParse({ caseName: "class", flaggedLines: ["1"] }).success).toBe(
      false,
    );
  });

  it("refuses a verdict with no case name", () => {
    expect(caseVerdictSchema.safeParse({ flaggedLines: [] }).success).toBe(false);
  });

  it("infers flagged lines as a readonly array", () => {
    const readonlyLines: Equal<CaseVerdict["flaggedLines"], readonly number[]> = true;
    expect(readonlyLines).toBe(true);
  });
});

describe("projectionWriteSchema", () => {
  it.each(["written", "unchanged"])("accepts a %s write", (effect) => {
    expect(projectionWriteSchema.safeParse({ path: "eslint.config.js", effect })).toEqual({
      success: true,
      data: { path: "eslint.config.js", effect },
    });
  });

  it("refuses an effect outside written and unchanged", () => {
    expect(
      projectionWriteSchema.safeParse({ path: "eslint.config.js", effect: "deleted" }).success,
    ).toBe(false);
  });

  it("refuses a write whose path is not a repository path", () => {
    expect(
      projectionWriteSchema.safeParse({ path: "../eslint.config.js", effect: "written" }).success,
    ).toBe(false);
  });
});

describe("runnerResultSchema", () => {
  it("parses an ok envelope carrying its value", () => {
    expect(
      runnerResultSchema({ value: projectionWriteSchema }).safeParse({
        outcome: "ok",
        value: write,
      }),
    ).toEqual({
      success: true,
      data: { outcome: "ok", value: write },
    });
  });

  it("parses a failed envelope carrying a runner failure", () => {
    expect(
      runnerResultSchema({ value: projectionWriteSchema }).safeParse({
        outcome: "failed",
        error: { kind: "tool-failed", detail: "eslint exited 2" },
      }),
    ).toEqual({
      success: true,
      data: { outcome: "failed", error: { kind: "tool-failed", detail: "eslint exited 2" } },
    });
  });

  it("refuses an ok envelope whose value fails the value schema", () => {
    expect(
      runnerResultSchema({ value: projectionWriteSchema }).safeParse({
        outcome: "ok",
        value: "no write",
      }).success,
    ).toBe(false);
  });

  it("refuses a failed envelope whose error is not a runner failure", () => {
    expect(
      runnerResultSchema({ value: projectionWriteSchema }).safeParse({
        outcome: "failed",
        error: { kind: "disk-full" },
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { repoPathOf } from "../repository/repo-path-of.ts";
import { editionOf } from "../rule-set/edition-of.ts";
import type { SourceCase } from "../rule-set/rule-set-types.ts";
import { casesByEdition } from "./edition-runs.ts";

const DEFAULT_EDITION = editionOf("1");
const SECOND = editionOf("2");
const UNSTATED: SourceCase = {
  name: "if statement",
  fileName: repoPathOf("a.test.ts"),
  source: "if (x) {}\n",
  expectedLines: [1],
};
const FIRST: SourceCase = {
  name: "plain",
  fileName: repoPathOf("b.test.ts"),
  source: "expect(1).toBe(1);\n",
  expectedLines: [],
  edition: editionOf("1"),
};
const LATER: SourceCase = {
  name: "nullish",
  fileName: repoPathOf("c.test.ts"),
  source: "a ?? b;\n",
  expectedLines: [1],
  edition: SECOND,
};

describe("casesByEdition", () => {
  it("runs every case under the default edition when no case names another", () => {
    expect(casesByEdition({ defaultEdition: DEFAULT_EDITION, cases: [UNSTATED, FIRST] })).toEqual([
      { edition: DEFAULT_EDITION, cases: [UNSTATED, FIRST] },
    ]);
  });

  it("runs each named edition's cases apart, the default edition first", () => {
    expect(
      casesByEdition({ defaultEdition: DEFAULT_EDITION, cases: [LATER, UNSTATED, FIRST] }),
    ).toEqual([
      { edition: DEFAULT_EDITION, cases: [UNSTATED, FIRST] },
      { edition: SECOND, cases: [LATER] },
    ]);
  });

  it("runs nothing under the default edition when every case names another", () => {
    expect(casesByEdition({ defaultEdition: DEFAULT_EDITION, cases: [LATER] })).toEqual([
      { edition: SECOND, cases: [LATER] },
    ]);
  });
});

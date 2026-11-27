import { describe, expect, it } from "vitest";

import { repoPathOf } from "./repo-path-of.ts";
import { baseJudgementOf, type TouchedSet, withoutPureMoves } from "./touched-set.ts";

const A = repoPathOf("a.ts");

const MOVED = repoPathOf("src/moved/b.ts");

const EDITED = repoPathOf("src/edited/c.ts");

describe("baseJudgementOf", () => {
  it.each<{
    readonly name: string;
    readonly touched: TouchedSet;
    readonly judgement: "in-this-run" | "left-to-another-run";
  }>([
    {
      name: "a touched set measured against a base",
      touched: { measured: "yes", paths: new Set([A]) },
      judgement: "in-this-run",
    },
    {
      name: "a touched set that could not be measured",
      touched: { measured: "no", base: { state: "not-given" } },
      judgement: "in-this-run",
    },
    {
      name: "a touched set left to another run",
      touched: { measured: "elsewhere" },
      judgement: "left-to-another-run",
    },
  ])("judges what needs the base $judgement for $name", ({ touched, judgement }) => {
    expect(baseJudgementOf({ touched })).toBe(judgement);
  });
});

describe("withoutPureMoves", () => {
  it("keeps the landing evidence and edits while dropping unchanged moves", () => {
    expect(
      withoutPureMoves({
        touched: { measured: "yes", paths: new Set([A, MOVED, EDITED]), landingRevision: "pinned" },
        renamed: new Map([
          [MOVED, { basePath: repoPathOf("src/b.ts"), content: "unchanged" }],
          [EDITED, { basePath: repoPathOf("src/c.ts"), content: "edited" }],
        ]),
      }),
    ).toEqual({ measured: "yes", paths: new Set([A, EDITED]), landingRevision: "pinned" });
  });

  it("keeps a touched set that was not measured as it is", () => {
    expect(
      withoutPureMoves({
        touched: { measured: "no", base: { state: "not-given" } },
        renamed: new Map([[MOVED, { basePath: repoPathOf("src/b.ts"), content: "unchanged" }]]),
      }),
    ).toEqual({ measured: "no", base: { state: "not-given" } });
  });
});

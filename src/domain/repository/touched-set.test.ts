import { describe, expect, it } from "vitest";
import { baseJudgementOf, type TouchedSet } from "./touched-set.ts";
import { repoPathOf } from "./repo-path-of.ts";

const A = repoPathOf("a.ts");

describe("baseJudgementOf", () => {
  it.each<{ readonly name: string; readonly touched: TouchedSet; readonly judgement: "in-this-run" | "left-to-another-run" }>([
    { name: "a touched set measured against a base", touched: { measured: "yes", paths: new Set([A]) }, judgement: "in-this-run" },
    { name: "a touched set that could not be measured", touched: { measured: "no", base: { state: "not-given" } }, judgement: "in-this-run" },
    { name: "a touched set left to another run", touched: { measured: "elsewhere" }, judgement: "left-to-another-run" },
  ])("judges what needs the base $judgement for $name", ({ touched, judgement }) => {
    expect(baseJudgementOf({ touched })).toBe(judgement);
  });
});

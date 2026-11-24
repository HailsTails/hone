import { describe, expect, it, vi } from "vitest";

import {
  compareOwedPoints,
  findOwedPoint,
  findUnowedPointFaults,
  mapPointsToUnowed,
  type OwedPoint,
} from "./owed-points.ts";

describe("compareOwedPoints", () => {
  it.each([
    {
      name: "the same rule",
      left: { kind: "rule", name: "guard-first" },
      right: { kind: "rule", name: "guard-first" },
      sameness: "same",
    },
    {
      name: "a rule and a principle of one name",
      left: { kind: "rule", name: "guard-first" },
      right: { kind: "principle", name: "guard-first" },
      sameness: "different",
    },
    {
      name: "two rules",
      left: { kind: "rule", name: "guard-first" },
      right: { kind: "rule", name: "fail-fast" },
      sameness: "different",
    },
  ] as const)("finds $name $sameness", ({ left, right, sameness }) => {
    const compared = compareOwedPoints({ left, right });

    expect(compared).toBe(sameness);
  });
});

describe("mapPointsToUnowed", () => {
  it("gives each point the case does not owe, in the indication's order", () => {
    const owes = [{ kind: "rule", name: "guard-first" }] as const;
    const points = [
      { kind: "principle", name: "no-hidden-effects" },
      { kind: "rule", name: "guard-first" },
      { kind: "principle", name: "guard-first" },
    ] as const;

    const unowed = mapPointsToUnowed({ owes, points });

    expect(unowed).toEqual([
      { kind: "principle", name: "no-hidden-effects" },
      { kind: "principle", name: "guard-first" },
    ]);
  });

  it("gives nothing when the case owes every point", () => {
    const owes = [{ kind: "rule", name: "guard-first" }] as const;
    const points = [{ kind: "rule", name: "guard-first" }] as const;

    const unowed = mapPointsToUnowed({ owes, points });

    expect(unowed).toEqual([]);
  });
});

describe("findOwedPoint", () => {
  it("finds the owed entry that maps to the point", () => {
    const owes = [
      { rule: "fail-fast", kind: "rule", name: "fail-fast" },
      { rule: "guard-first", kind: "rule", name: "guard-first" },
    ] as const;
    const mapOwedToPoint = vi
      .fn<(owed: (typeof owes)[number]) => OwedPoint>()
      .mockReturnValueOnce({ kind: "rule", name: "fail-fast" })
      .mockReturnValueOnce({ kind: "rule", name: "guard-first" });

    const found = findOwedPoint({
      owes,
      point: { kind: "rule", name: "guard-first" },
      mapOwedToPoint,
    });

    expect(found).toEqual({ rule: "guard-first", kind: "rule", name: "guard-first" });
  });

  it("finds nothing when no owed entry maps to the point", () => {
    const owes = [{ kind: "rule", name: "guard-first" }] as const;
    const mapOwedToPoint = vi
      .fn<(owed: OwedPoint) => OwedPoint>()
      .mockReturnValueOnce({ kind: "rule", name: "guard-first" });

    const found = findOwedPoint({
      owes,
      point: { kind: "principle", name: "guard-first" },
      mapOwedToPoint,
    });

    expect(found).toBeUndefined();
  });
});

describe("findUnowedPointFaults", () => {
  it("names each point the owing case does not owe", () => {
    const owing = {
      name: "checks-before-work",
      owes: [{ kind: "rule", name: "guard-first" }],
    } as const;
    const points = [
      { kind: "rule", name: "guard-first" },
      { kind: "principle", name: "no-hidden-effects" },
    ] as const;

    const faults = findUnowedPointFaults({ symptom: "late-guard", owing, points });

    expect(faults).toEqual([
      "late-guard points checks-before-work at no-hidden-effects, which checks-before-work does not owe",
    ]);
  });

  it("finds no fault when the case owes every point", () => {
    const owing = {
      name: "checks-before-work",
      owes: [{ kind: "rule", name: "guard-first" }],
    } as const;
    const points = [{ kind: "rule", name: "guard-first" }] as const;

    const faults = findUnowedPointFaults({ symptom: "late-guard", owing, points });

    expect(faults).toEqual([]);
  });
});

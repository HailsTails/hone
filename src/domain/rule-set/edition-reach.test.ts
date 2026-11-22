import { describe, expect, it } from "vitest";

import { editionOf } from "./edition-of.ts";
import { editionOrder, editionReaches, isEdition } from "./edition-reach.ts";
import type { Edition, EditionReach } from "./edition-types.ts";

const ONE = editionOf("1");
const TWO = editionOf("2");
const TEN = editionOf("10");

describe("editionReaches", () => {
  it.each<{ readonly ran: Edition; readonly introducedIn: Edition; readonly reach: EditionReach }>([
    { ran: ONE, introducedIn: ONE, reach: "reached" },
    { ran: TWO, introducedIn: ONE, reach: "reached" },
    { ran: TEN, introducedIn: TWO, reach: "reached" },
    { ran: ONE, introducedIn: TWO, reach: "not-reached" },
    { ran: TWO, introducedIn: TEN, reach: "not-reached" },
  ])(
    "edition $ran against one introduced in $introducedIn is $reach",
    ({ ran, introducedIn, reach }) => {
      expect(editionReaches({ edition: ran, introducedIn })).toBe(reach);
    },
  );
});

describe("editionOrder", () => {
  it.each([
    { name: "a single edition", editions: [ONE], order: "ascending" },
    { name: "numerically ascending editions", editions: [ONE, TWO, TEN], order: "ascending" },
    { name: "descending editions", editions: [TWO, ONE], order: "unordered" },
    { name: "a repeated edition", editions: [ONE, ONE], order: "unordered" },
    {
      name: "editions ordered as text but not as numbers",
      editions: [ONE, TEN, TWO],
      order: "unordered",
    },
  ])("is $order for $name", ({ editions, order }) => {
    expect(editionOrder({ editions })).toBe(order);
  });
});

describe("isEdition", () => {
  it.each(["1", "2", "10"])("narrows %j to an edition", (text) => {
    expect(isEdition(text)).toBe(true);
  });

  it.each(["", "0", "01", "1.0", "v2", "latest"])("refuses %j", (text) => {
    expect(isEdition(text)).toBe(false);
  });
});

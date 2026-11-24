import { describe, expect, it } from "vitest";

import { basePathOf, headPathByBasePathOf } from "./renamed-path.ts";
import { repoPathOf } from "./repo-path-of.ts";

const BASKET = repoPathOf("src/basket.ts");
const CART = repoPathOf("src/cart.ts");
const TOTAL = repoPathOf("src/total.ts");

describe("basePathOf", () => {
  it("gives the path git saw a renamed file at in the base", () => {
    expect(
      basePathOf({
        file: CART,
        basePathOfRenamed: new Map([[CART, { basePath: BASKET, content: "edited" }]]),
      }),
    ).toBe(BASKET);
  });

  it("gives a file git saw no rename of at its own path", () => {
    expect(
      basePathOf({
        file: TOTAL,
        basePathOfRenamed: new Map([[CART, { basePath: BASKET, content: "unchanged" }]]),
      }),
    ).toBe(TOTAL);
  });
});

describe("headPathByBasePathOf", () => {
  it("gives the path each renamed file has now, by the path git saw it at in the base", () => {
    expect(
      headPathByBasePathOf({
        renamed: new Map([
          [CART, { basePath: BASKET, content: "edited" }],
          [TOTAL, { basePath: repoPathOf("src/sum.ts"), content: "unchanged" }],
        ]),
      }),
    ).toEqual(
      new Map([
        [BASKET, CART],
        ["src/sum.ts", TOTAL],
      ]),
    );
  });

  it("maps each base path once, so a chain a to b and b to c moves a to b and b to c", () => {
    expect(
      headPathByBasePathOf({
        renamed: new Map([
          [CART, { basePath: BASKET, content: "unchanged" }],
          [TOTAL, { basePath: CART, content: "unchanged" }],
        ]),
      }),
    ).toEqual(
      new Map([
        [BASKET, CART],
        [CART, TOTAL],
      ]),
    );
  });

  it("maps a swap both ways, a to b and b to a", () => {
    expect(
      headPathByBasePathOf({
        renamed: new Map([
          [CART, { basePath: BASKET, content: "unchanged" }],
          [BASKET, { basePath: CART, content: "unchanged" }],
        ]),
      }),
    ).toEqual(
      new Map([
        [BASKET, CART],
        [CART, BASKET],
      ]),
    );
  });
});

import { describe, expect, it } from "vitest";

import { basePathOf } from "./renamed-path.ts";
import { repoPathOf } from "./repo-path-of.ts";

const BASKET = repoPathOf("src/basket.ts");
const CART = repoPathOf("src/cart.ts");
const TOTAL = repoPathOf("src/total.ts");

describe("basePathOf", () => {
  it("gives the path git saw a renamed file at in the base", () => {
    expect(basePathOf({ file: CART, basePathOfRenamed: new Map([[CART, BASKET]]) })).toBe(BASKET);
  });

  it("gives a file git saw no rename of at its own path", () => {
    expect(basePathOf({ file: TOTAL, basePathOfRenamed: new Map([[CART, BASKET]]) })).toBe(TOTAL);
  });
});

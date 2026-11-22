import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { basePathOf } from "./renamed-path.ts";

const BASKET = repoPathSchema.parse("src/basket.ts");
const CART = repoPathSchema.parse("src/cart.ts");
const TOTAL = repoPathSchema.parse("src/total.ts");

describe("basePathOf", () => {
  it("gives the path git saw a renamed file at in the base", () => {
    expect(basePathOf({ file: CART, basePathOfRenamed: new Map([[CART, BASKET]]) })).toBe(BASKET);
  });

  it("gives a file git saw no rename of at its own path", () => {
    expect(basePathOf({ file: TOTAL, basePathOfRenamed: new Map([[CART, BASKET]]) })).toBe(TOTAL);
  });
});

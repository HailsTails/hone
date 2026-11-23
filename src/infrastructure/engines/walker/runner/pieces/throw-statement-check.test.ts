import { describe, expect, it } from "vitest";

import { throwSnippetOf, throwSourceScopeOf } from "./throw-statement-check.ts";

describe("throw observation source scope", () => {
  it.each([
    ["src/order.ts", "production"],
    ["src/order.tsx", "production"],
    ["src/order.mts", "production"],
    ["src/order.cts", "production"],
    ["src/order.spec.ts", "test"],
    ["src/order.spec.tsx", "test"],
    ["src/order.spec.mts", "test"],
    ["src/order.spec.cts", "test"],
    ["src/order.test.ts", "test"],
    ["src/order.test.tsx", "test"],
    ["src/order.test.mts", "test"],
    ["src/order.test.cts", "test"],
    ["src/order.test.js", "skipped"],
    ["src/order.d.ts", "skipped"],
    ["src/order.d.mts", "skipped"],
    ["src/order.d.cts", "skipped"],
    ["src/build/order.spec.ts", "skipped"],
    ["vendor/order.mts", "skipped"],
  ])("classifies %s as %s", (file, scope) => {
    expect(throwSourceScopeOf(file)).toBe(scope);
  });
});

describe("throw observation snippet", () => {
  it("renders a multiline throw on one line", () => {
    expect(throwSnippetOf('throw new Error(\r\n  "missing  order",\r\n);')).toBe(
      'throw new Error( "missing  order", );',
    );
  });

  it("caps a long statement to eighty characters before the ellipsis", () => {
    const messageStart = "x".repeat(63);
    expect(throwSnippetOf(`throw new Error("${messageStart} remainder");`)).toBe(
      `throw new Error("${messageStart}…`,
    );
  });
});

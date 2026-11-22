import { describe, expectTypeOf, it } from "vitest";
import type { Anchor, AnchorKind } from "./anchor.ts";

describe("anchor types", () => {
  it("defines AnchorKind as the keyword or file union", () => {
    expectTypeOf<AnchorKind>().toEqualTypeOf<
      | { readonly kind: "keyword"; readonly keyword: string }
      | { readonly kind: "file" }
    >();
  });

  it("defines Anchor as a line and a column", () => {
    expectTypeOf<Anchor>().toEqualTypeOf<{ readonly line: number; readonly column: number }>();
  });
});

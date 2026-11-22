import { describe, expect, it } from "vitest";
import { walkerPieceSettingsSchema } from "../../runner/pieces/walker-check-schema.ts";
import piece from "./piece.json" with { type: "json" };

describe("class keyword audit declaration", () => {
  it("holds keyword anchoring and names the walker module", () => {
    expect(piece.anchor).toEqual({ kind: "keyword", keyword: "class" });
    expect(walkerPieceSettingsSchema.safeParse(piece.settings)).toEqual({
      success: true,
      data: { module: "class-syntax.ts" },
    });
  });
});

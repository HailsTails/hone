import { describe, expect, it } from "vitest";

import { DEFAULT_CONVENTIONS } from "./conventions.ts";

describe("DEFAULT_CONVENTIONS", () => {
  it("holds no generated folders and no layers, as no check reads either today", () => {
    expect(DEFAULT_CONVENTIONS).toEqual({ generated: [], layers: [] });
  });
});

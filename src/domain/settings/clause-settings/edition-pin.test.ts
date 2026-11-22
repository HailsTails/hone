import { describe, expect, it } from "vitest";

import { editionPinOf } from "./edition-pin.ts";

describe("editionPinOf", () => {
  it("is unpinned with no settings given", () => {
    expect(editionPinOf({ given: undefined })).toEqual({ pin: undefined, rest: undefined });
  });

  it("separates the edition from the piece's own settings", () => {
    expect(editionPinOf({ given: { edition: "2", trackerPatterns: ["^x$"] } })).toEqual({
      pin: "2",
      rest: { trackerPatterns: ["^x$"] },
    });
  });

  it("leaves no piece settings when the edition is all that is given", () => {
    expect(editionPinOf({ given: { edition: "1" } })).toEqual({ pin: "1", rest: undefined });
  });

  it("keeps an empty settings object as given when it names no edition", () => {
    expect(editionPinOf({ given: {} })).toEqual({ pin: undefined, rest: {} });
  });
});

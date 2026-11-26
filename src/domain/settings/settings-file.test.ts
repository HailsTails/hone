import { expect, it } from "vitest";

import { DEFAULT_PROJECTION_KIND } from "./settings-file.ts";

it("uses the JavaScript projection pair by default", () => {
  expect(DEFAULT_PROJECTION_KIND).toBe("mjs");
});

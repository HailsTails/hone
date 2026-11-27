import { describe, expect, it } from "vitest";

import { readHoneRules } from "./hone-rules.ts";

describe("readHoneRules", () => {
  it("includes only the Hone rule named by the ESLint plugin", () => {
    const rules = readHoneRules({ names: ["no-class-authoring"] });

    expect(rules).toEqual({ "no-class-authoring": expect.any(Object) });
  });
});
